const { ethers } = require("ethers");
const fetch = require("node-fetch");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

const votes = { yes: 0, no: 0 };

async function handle_advance(data) {
    console.log("Received advance request data " + JSON.stringify(data));

    const { vote } = data;

    if (vote === "yes") {
        votes.yes += 1;
    } else if (vote === "no") {
        votes.no += 1;
    } else {
        console.log("Invalid vote received");
        return "reject";
    }

    // Submit a notice for the vote
    await submitNotice({ vote });

    console.log(`Updated votes: Yes: ${votes.yes}, No: ${votes.no}`);
    return "accept";
}

async function handle_inspect(data) {
    console.log("Received inspect request data " + JSON.stringify(data));

    const result = {
        yes: votes.yes,
        no: votes.no,
    };

    // Generate a report with the current vote tally
    await generateReport(result);

    console.log("Returning vote results: " + JSON.stringify(result));
    return result;
}

// Helper functions to interact with Cartesi Rollups APIs
async function submitNotice(notice) {
    const response = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: notice }),
    });

    if (response.ok) {
        console.log("Notice submitted successfully");
    } else {
        console.log("Failed to submit notice");
    }
}

async function generateReport(report) {
    const response = await fetch(rollup_server + "/report", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: report }),
    });

    if (response.ok) {
        console.log("Report generated successfully");
    } else {
        console.log("Failed to generate report");
    }
}

var handlers = {
    advance_state: handle_advance,
    inspect_state: handle_inspect,
};

(async () => {
    while (true) {
        const finish_req = await fetch(rollup_server + "/finish", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ status: "accept" }),
        });

        console.log("Received finish status " + finish_req.status);

        if (finish_req.status == 202) {
            console.log("No pending rollup request, trying again");
        } else {
            const rollup_req = await finish_req.json();
            var handler = handlers[rollup_req["request_type"]];
            const result = await handler(rollup_req["data"]);

            const response = await fetch(rollup_server + "/finish", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status: result }),
            });

            console.log("Processed request with response status " + response.status);
        }
    }
})();
