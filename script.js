const SUPABASE_URL =
    "https://ghteiwpgzifmmbgtlbeg.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_QKP33S0B2ABkIJoNKbWW7Q_RJaYp9be";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ============================
// REPORT COOLDOWN
// ============================

const REPORT_COOLDOWN = 30 * 1000;

// Stores when each barrel was last reported
const reportCooldowns = {};


// ============================
// GET ALL BARRELS
// ============================

async function getBarrels() {

    const { data, error } =
        await supabaseClient
            .from("barrels")
            .select("*")
            .order("id");

    if (error) {

        console.error("Error loading barrels:", error);

        document.getElementById("barrels").textContent =
            "Couldn't load the Slurpee barrels 😭";

        return [];
    }

    return data;
}


// ============================
// GET STATUS OF ONE BARREL
// ============================

async function getBarrelStatus(barrelId) {

    const { data, error } =
        await supabaseClient
            .from("reports")
            .select("status, created_at")
            .eq("barrel", barrelId)
            .order("created_at", { ascending: false })
            .limit(50);

    if (error) {

        console.error("Error loading reports:", error);

        return null;
    }


    // No reports yet
    if (data.length === 0) {

        return {
            status: "unknown",
            confidence: null,
            working: 0,
            broken: 0,
            lastReported: null,
            lastReportedStatus: null
        };
    }


    let workingWeight = 0;
    let brokenWeight = 0;

    let working = 0;
    let broken = 0;


    // Newest report
    const lastReported =
        data[0].created_at;

    const lastReportedStatus =
        data[0].status;


    // Work out how much each report should count
    for (const report of data) {

        const ageMinutes =
            (Date.now() -
                new Date(report.created_at).getTime()) /
            60000;


        let weight;


        if (ageMinutes < 15) {

            weight = 1.00;

        } else if (ageMinutes < 60) {

            weight = 0.90;

        } else if (ageMinutes < 180) {

            weight = 0.75;

        } else if (ageMinutes < 360) {

            weight = 0.55;

        } else if (ageMinutes < 720) {

            weight = 0.40;

        } else if (ageMinutes < 1440) {

            weight = 0.25;

        } else if (ageMinutes < 2880) {

            weight = 0.12;

        } else if (ageMinutes < 4320) {

            weight = 0.05;

        } else {

            // Older than 3 days
            weight = 0;
        }


        // Ignore reports older than 3 days
        if (weight === 0) {
            continue;
        }


        if (report.status === true) {

            workingWeight += weight;
            working++;

        } else {

            brokenWeight += weight;
            broken++;
        }
    }


    const totalWeight =
        workingWeight + brokenWeight;


    // All reports are older than 3 days
    if (totalWeight === 0) {

        return {
            status: "unknown",
            confidence: null,
            working: 0,
            broken: 0,
            lastReported: lastReported,
            lastReportedStatus: lastReportedStatus
        };
    }


    const confidence =
        workingWeight / totalWeight;


    let status;


    if (confidence >= 0.70) {

        status = "working";

    } else if (confidence >= 0.40) {

        status = "uncertain";

    } else {

        status = "broken";
    }


    return {
        status: status,
        confidence: confidence,
        working: working,
        broken: broken,
        lastReported: lastReported,
        lastReportedStatus: lastReportedStatus
    };
}


// ============================
// TIME AGO
// ============================

function timeAgo(timestamp, status) {

    if (!timestamp) {
        return "No reports yet";
    }


    const seconds =
        Math.floor(
            (Date.now() -
                new Date(timestamp).getTime()) /
            1000
        );


    let timeText;


    if (seconds < 60) {

        timeText = "just now";

    } else {

        const minutes =
            Math.floor(seconds / 60);


        if (minutes < 60) {

            timeText =
                `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

        } else {

            const hours =
                Math.floor(minutes / 60);


            if (hours < 24) {

                timeText =
                    `${hours} hour${hours === 1 ? "" : "s"} ago`;

            } else {

                const days =
                    Math.floor(hours / 24);

                timeText =
                    `${days} day${days === 1 ? "" : "s"} ago`;
            }
        }
    }


    const statusText =
        status === true
            ? "working"
            : "not working";


    return `Last reported ${statusText} ${timeText}`;
}


// ============================
// DISPLAY THE BARRELS
// ============================

async function displayBarrels() {

    const barrels =
        await getBarrels();

    const container =
        document.getElementById("barrels");

    container.innerHTML = "";


    // Store the results so we can calculate overall status
    const barrelResults = [];


    for (const barrel of barrels) {

        const result =
            await getBarrelStatus(barrel.id);


        barrelResults.push({
            barrel: barrel,
            result: result
        });


        let statusEmoji;
        let statusText;


        if (!result) {

            statusEmoji = "❓";
            statusText = "ERROR";

        } else if (result.status === "working") {

            statusEmoji = "🟢";
            statusText = "LIKELY WORKING";

        } else if (result.status === "broken") {

            statusEmoji = "🔴";
            statusText = "LIKELY NOT WORKING";

        } else if (result.status === "uncertain") {

            statusEmoji = "🟡";
            statusText = "UNCERTAIN";

        } else {

            statusEmoji = "⚪";
            statusText = "NO REPORTS";
        }


        let confidenceText = "";


        if (
            result &&
            result.confidence !== null
        ) {

            confidenceText =
                `${Math.round(
                    result.confidence * 100
                )}% confidence`;
        }


        let reportText = "";
        let lastReportedText = "";


        if (result) {

            reportText =
                `${result.working} working · ${result.broken} not working`;


            lastReportedText =
                timeAgo(
                    result.lastReported,
                    result.lastReportedStatus
                );
        }


        const card =
            document.createElement("div");


        card.className =
            `barrel status-${result ? result.status : "unknown"}`;


        card.id =
            `barrel-${barrel.id}`;


        card.innerHTML = `

            <h2>🥤 Barrel ${barrel.id}</h2>

<h3>
    ${barrel.flavour || "Unknown flavour"}
</h3>

<p>
    ${barrel.description || ""}
</p>

<div class="flavour-suggestions">

    <strong>💡 Flavour change?</strong>

    <div class="suggestion-form">

        <input
            type="text"
            id="suggestion-${barrel.id}"
            placeholder="What flavour is it now?"
            maxlength="100"
        >

        <button onclick="submitFlavourSuggestion(${barrel.id})">
            Submit
        </button>

    </div>

    <div
        class="suggestion-message"
        id="suggestion-message-${barrel.id}"
    ></div>

    <div
        class="suggestion-list"
        id="suggestions-${barrel.id}"
    >
        Loading suggestions...
    </div>

</div>

            ${
                barrel.active
                    ? `

                        <div class="status">
                            <strong>
                                ${statusEmoji} ${statusText}
                            </strong>
                        </div>

                        <p class="confidence">
                            ${confidenceText}
                        </p>

                        <p class="report-count">
                            ${reportText}
                        </p>

                        <p class="last-reported">
                            ${lastReportedText}
                        </p>

                        <div class="buttons">

                            <button
                                onclick="reportStatus(${barrel.id}, true)"
                            >
                                🟢 Working
                            </button>

                            <button
                                onclick="reportStatus(${barrel.id}, false)"
                            >
                                🔴 Not working
                            </button>

                        </div>

                    `
                    : `

                        <div class="status">
                            <strong>
                                ⚪ CURRENTLY UNAVAILABLE
                            </strong>
                        </div>

                        <p>
                            This Slurpee flavour is currently unavailable.
                        </p>

                    `
            }

        `;


    container.appendChild(card);
    
    loadFlavourSuggestions(barrel.id);
    }


    // =========================
    // OVERALL STATUS
    // =========================

    const overallStatus =
        document.getElementById("overall-status");

    const overallDetails =
        document.getElementById("overall-details");


    if (!overallStatus || !overallDetails) {
        return;
    }


    const workingBarrels =
        barrelResults.filter(
            item =>
                item.result &&
                item.result.status === "working"
        ).length;


    const uncertainBarrels =
        barrelResults.filter(
            item =>
                item.result &&
                item.result.status === "uncertain"
        ).length;


    const brokenBarrels =
        barrelResults.filter(
            item =>
                item.result &&
                item.result.status === "broken"
        ).length;


    const totalBarrels =
        barrelResults.length;


    if (workingBarrels > brokenBarrels) {

        overallStatus.textContent =
            `🟢 ${workingBarrels} / ${totalBarrels} BARRELS LIKELY WORKING`;

        overallDetails.textContent =
            `${uncertainBarrels} uncertain · ${brokenBarrels} likely not working`;

    } else if (brokenBarrels > workingBarrels) {

        overallStatus.textContent =
            `🔴 ${workingBarrels} / ${totalBarrels} BARRELS LIKELY WORKING`;

        overallDetails.textContent =
            `${uncertainBarrels} uncertain · ${brokenBarrels} likely not working`;

    } else {

        overallStatus.textContent =
            `🟡 ${workingBarrels} / ${totalBarrels} BARRELS LIKELY WORKING`;

        overallDetails.textContent =
            `${uncertainBarrels} uncertain · ${brokenBarrels} likely not working`;
    }
}


// ============================
// SUBMIT A REPORT
// ============================

async function reportStatus(barrelId, status) {

    // Check whether this barrel is on cooldown
    const lastReport =
        reportCooldowns[barrelId];


    if (lastReport) {

        const elapsed =
            Date.now() - lastReport;


        const remaining =
            REPORT_COOLDOWN - elapsed;


        if (remaining > 0) {

            const seconds =
                Math.ceil(remaining / 1000);


            document.getElementById("message").textContent =
                `You've already reported Barrel ${barrelId}. Try again in ${seconds}s! 🥤`;

            return;
        }
    }


    // Submit the report
    const { error } =
        await supabaseClient
            .from("reports")
            .insert({
                barrel: barrelId,
                status: status
            });


    if (error) {

        console.error(
            "Error submitting report:",
            error
        );


        document.getElementById("message").textContent =
            "Something went wrong 😭";

        return;
    }


    // Start cooldown only after successful report
    reportCooldowns[barrelId] =
        Date.now();


    document.getElementById("message").textContent =
        "Report submitted! Thanks 🥤";


    // Find the existing card
    const card =
        document.getElementById(
            `barrel-${barrelId}`
        );


    if (!card) {
        return;
    }


    // Get the current numbers displayed on the card
    const reportCount =
        card.querySelector(".report-count");


    const text =
        reportCount.textContent;


    const match =
        text.match(
            /(\d+) working · (\d+) not working/
        );


    if (!match) {
        return;
    }


    let working =
        parseInt(match[1]);


    let broken =
        parseInt(match[2]);


    // Add the new report
    if (status === true) {

        working++;

    } else {

        broken++;
    }


    const total =
        working + broken;


    const confidence =
        working / total;


    // Work out the new status
    let statusEmoji;
    let statusText;
    let newStatus;


    if (confidence >= 0.70) {

        statusEmoji = "🟢";
        statusText = "LIKELY WORKING";
        newStatus = "working";

    } else if (confidence >= 0.40) {

        statusEmoji = "🟡";
        statusText = "UNCERTAIN";
        newStatus = "uncertain";

    } else {

        statusEmoji = "🔴";
        statusText = "LIKELY NOT WORKING";
        newStatus = "broken";
    }


    // Update the status text
    card.querySelector(".status").innerHTML =
        `<strong>${statusEmoji} ${statusText}</strong>`;


    // Update the card colour
    card.classList.remove(
        "status-working",
        "status-uncertain",
        "status-broken",
        "status-unknown"
    );


    card.classList.add(
        `status-${newStatus}`
    );


    // Update confidence
    card.querySelector(".confidence").textContent =
        `${Math.round(confidence * 100)}% confidence`;


    // Update report count
    card.querySelector(".report-count").textContent =
        `${working} working · ${broken} not working`;


    // Update the last reported time
    card.querySelector(".last-reported").textContent =
        "Last reported " +
        (status === true
            ? "working just now"
            : "not working just now");
}

// ============================
// FLAVOUR SUGGESTIONS
// ============================

async function getFlavourSuggestions(barrelId) {

    const { data, error } =
        await supabaseClient
            .from("flavour_suggestions")
            .select("suggestion, created_at")
            .eq("barrel", barrelId)
            .order("created_at", { ascending: false })
            .limit(10);

    if (error) {

        console.error(
            "Error loading flavour suggestions:",
            error
        );

        return [];
    }

    return data;
}


async function loadFlavourSuggestions(barrelId) {

    const container =
        document.getElementById(
            `suggestions-${barrelId}`
        );

    if (!container) {
        return;
    }


    const suggestions =
        await getFlavourSuggestions(barrelId);


    if (suggestions.length === 0) {

        container.innerHTML =
            "<small>No suggestions yet.</small>";

        return;
    }


    container.innerHTML = "";


    for (const suggestion of suggestions) {

        const item =
            document.createElement("div");

        item.className =
            "suggestion-item";


        const date =
            new Date(suggestion.created_at);


        const time =
            timeAgo(date.toISOString(), null);


        item.innerHTML = `
            <span>
                ${suggestion.suggestion}
            </span>

            <small>
                ${time}
            </small>
        `;


        container.appendChild(item);
    }
}


async function submitFlavourSuggestion(barrelId) {

    const input =
        document.getElementById(
            `suggestion-${barrelId}`
        );


    const message =
        document.getElementById(
            `suggestion-message-${barrelId}`
        );


    const suggestion =
        input.value.trim();


    if (!suggestion) {

        message.textContent =
            "Please enter a flavour.";

        return;
    }


    const { error } =
        await supabaseClient
            .from("flavour_suggestions")
            .insert({
                barrel: barrelId,
                suggestion: suggestion
            });


    if (error) {

        console.error(
            "Error submitting flavour suggestion:",
            error
        );

        message.textContent =
            "Couldn't submit suggestion 😭";

        return;
    }


    input.value = "";


    message.textContent =
        "Suggestion submitted! 🥤";


    await loadFlavourSuggestions(barrelId);
}

// ============================
// START THE WEBSITE
// ============================

displayBarrels();
