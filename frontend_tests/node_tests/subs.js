"use strict";

const {strict: assert} = require("assert");

const {stub_templates} = require("../zjsunit/handlebars");
const {set_global, zrequire} = require("../zjsunit/namespace");
const {run_test} = require("../zjsunit/test");
const $ = require("../zjsunit/zjquery");

const ui = set_global("ui", {
    get_content_element: (element) => element,
    get_scroll_element: (element) => element,
});
const stream_data = zrequire("stream_data");
set_global("page_params", {});

const denmark_stream_id = 101;

set_global("location", {
    hash: `#streams/${denmark_stream_id}/announce`,
});

const subs = zrequire("subs");

set_global("hash_util", {
    by_stream_uri: () => {},
});

run_test("redraw_left_panel", (override) => {
    override(subs, "add_tooltip_to_left_panel_row", () => {});

    // set-up sub rows stubs
    const denmark = {
        elem: "denmark",
        subscribed: false,
        name: "Denmark",
        stream_id: denmark_stream_id,
        description: "Copenhagen",
        subscribers: [1],
        stream_weekly_traffic: null,
        color: "red",
    };
    const poland = {
        elem: "poland",
        subscribed: true,
        name: "Poland",
        stream_id: 102,
        description: "monday",
        subscribers: [1, 2, 3],
        stream_weekly_traffic: 13,
        color: "red",
    };
    const pomona = {
        elem: "pomona",
        subscribed: true,
        name: "Pomona",
        stream_id: 103,
        description: "college",
        subscribers: [],
        stream_weekly_traffic: 0,
        color: "red",
    };
    const cpp = {
        elem: "cpp",
        subscribed: true,
        name: "C++",
        stream_id: 104,
        description: "programming lang",
        subscribers: [1, 2],
        stream_weekly_traffic: 6,
        color: "red",
    };
    const zzyzx = {
        elem: "zzyzx",
        subscribed: true,
        name: "Zzyzx",
        stream_id: 105,
        description: "california town",
        subscribers: [1, 2],
        stream_weekly_traffic: 6,
        color: "red",
    };

    const sub_row_data = [denmark, poland, pomona, cpp, zzyzx];

    for (const sub of sub_row_data) {
        stream_data.create_sub_from_server_data(sub);
    }

    let populated_subs;

    stub_templates((fn, data) => {
        assert.equal(fn, "subscriptions");
        populated_subs = data.subscriptions;
    });

    subs.render_left_panel_superset();

    const sub_stubs = [];

    for (const data of populated_subs) {
        const sub_row = `.stream-row-${CSS.escape(data.elem)}`;
        sub_stubs.push(sub_row);

        $(sub_row).attr("data-stream-id", data.stream_id);
        $(sub_row).detach = () => sub_row;
    }

    $.create("#subscriptions_table .stream-row", {children: sub_stubs});

    let ui_called = false;
    ui.reset_scrollbar = (elem) => {
        ui_called = true;
        assert.equal(elem, $("#subscription_overlay .streams-list"));
    };

    // Filtering has the side effect of setting the "active" class
    // on our current stream, even if it doesn't match the filter.
    const denmark_row = $(`.stream-row[data-stream-id='${CSS.escape(denmark_stream_id)}']`);
    // sanity check it's not set to active
    assert(!denmark_row.hasClass("active"));

    function test_filter(params, expected_streams) {
        const stream_ids = subs.redraw_left_panel(params);
        assert.deepEqual(
            stream_ids,
            expected_streams.map((sub) => sub.stream_id),
        );
    }

    // Search with single keyword
    test_filter({input: "Po", subscribed_only: false}, [poland, pomona]);
    assert(ui_called);

    // The denmark row is active, even though it's not displayed.
    assert(denmark_row.hasClass("active"));

    // Search with multiple keywords
    test_filter({input: "Denmark, Pol", subscribed_only: false}, [denmark, poland]);
    test_filter({input: "Den, Pol", subscribed_only: false}, [denmark, poland]);

    // Search is case-insensitive
    test_filter({input: "po", subscribed_only: false}, [poland, pomona]);

    // Search handles unusual characters like C++
    test_filter({input: "c++", subscribed_only: false}, [cpp]);

    // Search subscribed streams only
    test_filter({input: "d", subscribed_only: true}, [poland]);

    // Search terms match stream description
    test_filter({input: "Co", subscribed_only: false}, [denmark, pomona]);

    // Search names AND descriptions
    test_filter({input: "Mon", subscribed_only: false}, [pomona, poland]);

    // Explicitly order streams by name
    test_filter({input: "", subscribed_only: false, sort_order: "by-stream-name"}, [
        cpp,
        denmark,
        poland,
        pomona,
        zzyzx,
    ]);

    // Order streams by subscriber count
    test_filter({input: "", subscribed_only: false, sort_order: "by-subscriber-count"}, [
        poland,
        cpp,
        zzyzx,
        denmark,
        pomona,
    ]);

    // Order streams by weekly traffic
    test_filter({input: "", subscribed_only: false, sort_order: "by-weekly-traffic"}, [
        poland,
        cpp,
        zzyzx,
        pomona,
        denmark,
    ]);

    // Sort for subscribed only.
    test_filter({input: "", subscribed_only: true, sort_order: "by-subscriber-count"}, [
        poland,
        cpp,
        zzyzx,
        pomona,
    ]);

    // active stream-row is not included in results
    $(".stream-row-denmark").addClass("active");
    $(".stream-row.active").hasClass = (cls) => {
        assert.equal(cls, "notdisplayed");
        return $(".stream-row-denmark").hasClass("active");
    };
    $(".stream-row.active").removeClass = (cls) => {
        assert.equal(cls, "active");
        $(".stream-row-denmark").removeClass("active");
    };

    test_filter({input: "d", subscribed_only: true}, [poland]);
    assert(!$(".stream-row-denmark").hasClass("active"));
    assert(!$(".right .settings").visible());
    assert($(".nothing-selected").visible());
});
