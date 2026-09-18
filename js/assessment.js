/* ==========================================================================
   AIRWARM — assessment.js
   Runs the Home Energy Assessment on /home-energy-assessment/.

   TWO THINGS TO UNDERSTAND BEFORE EDITING THIS FILE
   -------------------------------------------------
   1. NOTHING LEAVES THE BROWSER UNTIL THE VISITOR DECIDES IT SHOULD. The four
      stages, the scoring and the result are all computed on the visitor's own
      device. No cookie, no local storage, nothing written to disk.

      There is exactly ONE network request in this file, and it only happens
      when someone fills in the enquiry form after their result and ticks the
      consent box. Everything about that is at the WIRE-UP POINT near the
      bottom of this file. If you are adding a second place that transmits,
      stop: put it there instead, or the privacy policy stops being true.

      The form does not appear at all unless ENQUIRY_ENDPOINT below is set.
      That is the safety catch — an unconfigured deployment cannot collect
      anything, it just offers the e-mail and telephone route as before.

   2. THE SCORING BELOW IS NOT APPROVED. The Airwarm pack specifies the three
      outcomes and their wording, but it does not say which answers lead to
      which outcome. Rather than hide an invented rule inside the code, every
      threshold is a named value in the one config object below, and every
      one of them is listed as a question in TRIAGE_RULES_FOR_REVIEW.md.

      That document is NOT in this repository — it was removed when the site
      started serving from GitHub Pages, because it is an internal review
      document and this repository is public. It lives in the Airwarm working
      pack alongside HANDOVER.md. Part 13 covers the questions added with the
      August 2026 form additions.
   ========================================================================== */

/* ==========================================================================
   ENQUIRY ENDPOINT — the one piece of configuration in this file.

   Set this to the URL that receives the enquiry form. Leave it as an empty
   string and the form is not rendered at all: visitors get the e-mail and
   telephone invitation instead, and the site collects nothing. That is the
   default on purpose, so no deployment can start collecting by accident.

   BEFORE SETTING IT, all of the following must already be true:
     - the privacy policy at /privacy/ describes this form   (done)
     - it names the data controller                          (done — AIRWARM LTD)
     - it states the lawful basis and the retention period   (done — consent, 12 months)
     - the consent checkbox is unticked by default           (done — see buildEnquiryForm)
     - the endpoint forwards to hello@airwarm.co.uk and keeps no copy

   The endpoint is the Google Apps Script web app in /endpoint/. It sends one
   e-mail and stores nothing, which is what keeps the privacy policy's "no
   database, no third-party dashboard" sentence true. Setup instructions are
   in endpoint/README.md.

   If you ever point this somewhere that DOES keep a copy of submissions,
   that service is a processor under UK GDPR and must be named in the privacy
   policy BEFORE the URL changes here.
   ========================================================================== */
var ENQUIRY_ENDPOINT = "https://script.google.com/macros/s/AKfycbwtF0cC5xgjLxxw5TvZn0yWYSCRLUGb6ApSHV87itDav2S0RZxQClnmRaCiDlkLEc8e/exec";

/* ==========================================================================
   TRIAGE CONFIGURATION — what is settled and what is not.
   ==========================================================================
   SETTLED by Thomas Robinson's action plans of 15 and 17 September 2026, and
   not to be changed without a further instruction from him:

     • the three outcome labels (outcomeLabels below);
     • that there is no questionnaire-level RED result;
     • the cylinder rule — no conventional cylinder space is an uncertainty
       capping at BLUE, never a constraint forcing AMBER, because Airwarm
       installs Sunamp thermal storage;
     • that AMBER must name a real constraint from the visitor's answers, and
       that AMBER is not offered the submission form;
     • that the intake fields in nonScoringIntakeFields do not score.

   NOT SETTLED. The point values in answerPoints and the two numbers in
   outcomeThresholds were chosen by the website builder as a starting point.
   They have not been reviewed by anyone technically qualified, and no
   Airwarm document sets them. They are deliberately left alone by the
   September 2026 passes, which changed behaviour around the score rather
   than the score itself.

   This is why the page tells the visitor, in the outcome text, that the
   result is indicative and that a person makes the real judgement. Do not
   remove those sentences while the numbers above remain unreviewed.
   ========================================================================== */
var AIRWARM_TRIAGE_CONFIG = {

  /* ---- Step 1: how many points each answer is worth -------------------
     Higher points mean the answer points towards a heat pump working well.
     Negative points mean it points away. Zero means neutral, and is also
     used for every "Not sure" answer so that honesty is never penalised. */
  answerPoints: {

    /* Stage 1 — property */
    propertyType: {
      detached: 2,
      semiDetached: 2,
      endTerrace: 1,
      midTerrace: 1,
      backToBack: 0,
      bungalow: 2,
      flat: 0
    },
    propertyAge: {
      pre1919: 0,
      interwar1919to1944: 1,
      postwar1945to1975: 1,
      modern1976to2002: 2,
      newest2003onwards: 3,
      notSure: 0
    },
    currentHeating: {
      mainsGasBoiler: 1,
      oilBoiler: 2,
      lpgBoiler: 2,
      electricStorageHeaters: 2,
      directElectric: 2,
      solidFuel: 1,
      existingHeatPump: 1,
      noHeating: 1
    },

    /* Stage 2 — condition */
    insulationConfidence: {
      goodThroughout: 3,
      partial: 1,
      limited: -1,
      notSure: 0
    },
    windows: {
      doubleOrTripleThroughout: 2,
      mixed: 1,
      mostlySingle: -1,
      notSure: 0
    },
    radiators: {
      modernAndGenerous: 2,
      standard: 1,
      smallOrOld: 0,
      noneOrUnderfloor: 1,
      notSure: 0
    },
    outdoorSpace: {
      yesClearSpace: 3,
      possiblyTight: 1,
      noObviousLocation: 0,   /* handled as a constraint below, not by points */
      notSure: 0
    },
    hotWaterSpace: {
      existingCylinder: 3,
      spaceAvailable: 2,
      noSpaceIdentified: 0,   /* handled as a constraint below, not by points */
      notSure: 0
    },

    /* Stage 3 — plans */
    renovationPlans: {
      majorRenovation: 2,
      someWork: 1,
      noWorkPlanned: 0
    },
    timescale: {
      withinSixMonths: 1,
      sixToTwelveMonths: 1,
      overTwelveMonths: 0,
      justResearching: 0
    },
    emitterWillingness: {
      yesIfNeeded: 3,
      maybeWithExplanation: 1,
      notWilling: 0          /* handled as a constraint below, not by points */
    }
  },

  /* ---- Step 2: the two score thresholds -------------------------------
     A total at or above likelySuitableMinimumScore gives GREEN, "Likely
     suitable". A total at or above potentiallySuitableMinimumScore gives
     BLUE, "Needs a closer look". Below that the score alone would give
     AMBER, "Potentially unsuitable" — but see assess(), which holds AMBER
     back to BLUE unless a named constraint justifies it.
     For reference, the maximum achievable total is about 26. */
  outcomeThresholds: {
    likelySuitableMinimumScore: 17,
    potentiallySuitableMinimumScore: 10
  },

  /* ---- Step 3: answers that stop a "Likely suitable" outcome ----------
     These are the practical obstacles listed in the Airwarm operating
     manual as common reasons a property is not currently a good candidate.
     Each one caps the result at "Needs a closer look" or lower, whatever
     the score, and each one produces a named explanation for the visitor so
     they always know WHY. Nothing here produces a blunt rejection.

     `kind` decides which result can show the explanation:
       "constraint"  — a known answer that creates a significant concern.
                       Shown on AMBER and BLUE.
       "uncertainty" — something that needs checking. Shown on BLUE only,
                       and never enough on its own to produce AMBER.

     THE CYLINDER RULE. Airwarm installs Sunamp thermal storage where a
     conventional cylinder will not fit, so "I cannot see where a cylinder
     would go" is an uncertainty, not a constraint. It caps at BLUE and must
     never be the reason a home is shown as AMBER. */
  constraintsThatCapTheOutcome: [
    {
      id: "noOutdoorLocation",
      field: "outdoorSpace",
      value: "noObviousLocation",
      capAt: "notCurrently",
      kind: "constraint",
      explanation: "You told us there is no obvious outdoor position for the " +
        "heat pump unit. The unit has to sit outside with clear air around " +
        "it, so without a workable position an installation may not be " +
        "possible."
    },
    {
      id: "noHotWaterSpace",
      field: "hotWaterSpace",
      value: "noSpaceIdentified",
      capAt: "potentially",
      kind: "uncertainty",
      explanation: "You could not see where a hot-water cylinder would go. " +
        "That needs checking rather than ruling anything out: where a " +
        "conventional cylinder will not fit, we can consider compact " +
        "thermal storage such as Sunamp. Whether that suits your home " +
        "depends on how much hot water the household uses and on the design."
    },
    {
      id: "emittersNotNegotiable",
      field: "emitterWillingness",
      value: "notWilling",
      capAt: "notCurrently",
      kind: "constraint",
      explanation: "You would rather keep the radiators exactly as they are. " +
        "A heat pump runs at a lower temperature than a boiler, and most " +
        "homes need at least some larger radiators to stay comfortable, so " +
        "this could make an efficient installation difficult."
    },
    {
      id: "poorFabricNoPlan",
      field: "insulationConfidence",
      value: "limited",
      requiresAlso: { field: "renovationPlans", value: "noWorkPlanned" },
      capAt: "potentially",
      kind: "constraint",
      explanation: "You told us the home has very little insulation and no " +
        "improvement work is planned. The home would lose heat faster than a " +
        "heat pump could comfortably replace it, and improving the fabric " +
        "first usually makes a much bigger difference than the choice of " +
        "heat pump."
    },
    {
      id: "restrictedProperty",
      field: "propertyRestrictions",
      value: "yes",
      capAt: "potentially",
      kind: "uncertainty",
      explanation: "You told us the property is listed, in a conservation " +
        "area or leasehold. None of those rules a heat pump out, but they can " +
        "change what is permitted and where the unit can go, so they need " +
        "checking."
    }
  ],

  /* ---- Step 3b: why a score-driven result came out below GREEN ---------
     Added 15 Sep 2026 for "Why you got this result".

     A result that is not capped above is decided by the score, and the score
     is lowered by answers that earn fewer points than the best answer to the
     same question. This table gives each of those answers its explanation,
     so the list the visitor sees is built from what they actually said and
     from the points that actually moved their result. Nothing here changes a
     single point.

     Only answers that score BELOW the best answer to their question belong
     here; collectReasons() ignores anything else, so an entry for a
     top-scoring answer can never be shown by mistake. Answers
     about the visitor's plans rather than the property (current heating,
     building work, timescale) are left out: they move the score a little,
     but they are not something a Desktop Review investigates.

     "Not sure" is always an uncertainty. It earns no points, so it does hold
     a score down, but it is not a finding about the home and it must never
     be presented as one.

     If a field has a cap rule above for the same answer, the cap's
     explanation is used and this one is skipped. */
  resultReasons: {
    propertyType: {
      backToBack: { kind: "uncertainty", text: "Back-to-back terraces " +
        "usually have little outside wall to choose from, so finding a " +
        "workable position for the outdoor unit needs checking." },
      flat: { kind: "uncertainty", text: "Flats and maisonettes often have " +
        "limited choice over where an outdoor unit can go, and may need the " +
        "building owner's agreement, so that needs checking." }
    },
    propertyAge: {
      pre1919: { kind: "uncertainty", text: "Your home was built before 1919. " +
        "Older homes can still be well suited to a heat pump when the system " +
        "is properly designed, but how the walls are built and how much heat " +
        "the home loses needs checking." },
      interwar1919to1944: { kind: "uncertainty", text: "Your home was built " +
        "between 1919 and 1944. Homes of that age can still be well suited to " +
        "a heat pump when the system is properly designed, but how the walls " +
        "are built and how much heat the home loses needs checking." },
      postwar1945to1975: { kind: "uncertainty", text: "Your home was built " +
        "between 1945 and 1975. Homes of that age can still be well suited to " +
        "a heat pump when the system is properly designed, but how much heat " +
        "the home loses needs checking." },
      notSure: { kind: "uncertainty", text: "You were not sure when the home " +
        "was built. That is not a mark against it; the age helps us " +
        "understand how it was built, so it is something we check." }
    },
    insulationConfidence: {
      partial: { kind: "uncertainty", text: "You told us the insulation has " +
        "only partly been done, so how much heat the home loses, and what " +
        "might be worth improving, needs checking." },
      limited: { kind: "constraint", text: "You told us the home has very " +
        "little insulation. A poorly insulated home loses heat quickly, which " +
        "makes a heat pump harder to size and more expensive to run until the " +
        "fabric is improved." },
      notSure: { kind: "uncertainty", text: "You were not sure how well " +
        "insulated the home is. That is normal and not a mark against it; " +
        "it is one of the first things a Desktop Review looks into." }
    },
    windows: {
      mixed: { kind: "uncertainty", text: "The windows are a mixture, so how " +
        "much heat is lost through them needs checking room by room." },
      mostlySingle: { kind: "constraint", text: "You told us the windows are " +
        "mostly single glazed. That adds considerably to the heat the home " +
        "loses, which makes a heat pump harder to size and run efficiently." },
      notSure: { kind: "uncertainty", text: "You were not sure what the " +
        "windows are like. That is something we can check." }
    },
    radiators: {
      standard: { kind: "uncertainty", text: "Your radiators are standard " +
        "sized. Some rooms may need a larger radiator to stay comfortable at " +
        "heat-pump temperatures; the room-by-room design works that out." },
      smallOrOld: { kind: "uncertainty", text: "You described the radiators " +
        "as small, old or a mixture. Some are likely to need replacing with " +
        "larger ones, and which ones is worked out in the design." },
      notSure: { kind: "uncertainty", text: "You were not sure what the " +
        "radiators are like. Whether any would need changing is something we " +
        "check." }
    },
    outdoorSpace: {
      possiblyTight: { kind: "uncertainty", text: "You told us space outside " +
        "for the unit might be tight. Whether a position works depends on the " +
        "equipment chosen and the manufacturer's requirements, so it needs " +
        "checking." },
      notSure: { kind: "uncertainty", text: "You were not sure whether there " +
        "is space outside for the unit. Finding a workable position is " +
        "something we check." }
    },
    hotWaterSpace: {
      spaceAvailable: { kind: "uncertainty", text: "There is no cylinder at " +
        "the moment, so the position you have in mind for one needs checking." },
      notSure: { kind: "uncertainty", text: "You were not sure whether there " +
        "is space for a hot-water cylinder. That is something we check, and " +
        "where a conventional cylinder will not fit we can consider compact " +
        "thermal storage such as Sunamp." }
    },
    emitterWillingness: {
      maybeWithExplanation: { kind: "uncertainty", text: "You would want any " +
        "radiator changes explained first. That is reasonable: whether any " +
        "are needed comes out of the room-by-room design, and we would " +
        "explain why before recommending them." }
    }
  },

  /* ---- Step 4: how far outside West Yorkshire we still respond --------
     Only the outward part of the postcode is asked for, and it is never
     sent anywhere. These are the outward-code prefixes Airwarm is starting
     with. An unrecognised prefix does NOT change the outcome; it only adds a
     note about service area. */
  serviceAreaOutwardPrefixes: ["BD", "LS", "HD", "HX", "WF"],

  /* ---- Step 5: wording of the outcome labels --------------------------
     These three labels are fixed by the Airwarm pack. Do not reword them. */
  outcomeLabels: {
    /* Customer-facing wording, per Tom's action plan of 15 Sep 2026:
         GREEN  likely       — Likely suitable
         BLUE   potentially  — Needs a closer look
         AMBER  notCurrently — Potentially unsuitable
       The keys are unchanged so the payload and the endpoint keep working.
       The CSS uppercases the labels, so keep sentence case here.

       "Potentially unsuitable" deliberately stops short of "Not suitable".
       This is a questionnaire, not a heat-loss survey, and it must not
       present itself as a final engineering judgement on somebody's house.
       There is no questionnaire-level RED result. */
    likely: "Likely suitable",
    potentially: "Needs a closer look",
    notCurrently: "Potentially unsuitable"
  },

  /* ---- Step 6: intake questions that deliberately do NOT score ---------
     Added 13 Aug 2026 from Airwarm_Online_Assessment_Form_Additions.md.

     Every one of these is asked because a person doing the desktop review
     needs it, not because anyone has decided what it should do to the
     outcome. The specification is explicit for two of them — the electrical
     panel is a "screening signal, not a confirmed fact", the pipework is a
     "named survey item, not a scored fact" — and silent on the other three.

     So none of them appear in answerPoints above and none of them cap the
     outcome. Giving them points would be inventing triage policy, which is
     the one thing this file is built not to do. They travel to Airwarm in
     the transcript and in the survey notes below, and a person decides what
     they mean.

     Listing them here is not decoration: two pieces of code read this list.
     The "not sure" tally that explains a held-back result ignores them, so
     that adding intake questions cannot quietly change anyone's result copy;
     and the survey notes are built only from fields named here.

     If Thomas ever decides one of these SHOULD score, it moves into
     answerPoints and comes off this list. Both, or the two disagree. */
  nonScoringIntakeFields: [
    "epcStatus",
    "insulationEvidence",
    "cylinderLocation",
    "consumerUnit",
    "radiatorPipework"
  ],

  /* ---- Step 7: what the intake answers mean to the person reviewing ----
     These notes go in the enquiry e-mail to Airwarm. They are NEVER shown to
     the visitor: "trace via thermal imaging with heating running" is a job
     instruction, not something a homeowner asked to read.

     The pipework and electrical wording is quoted from the specification
     rather than paraphrased, deliberately. Both exist to stop a photograph
     being mistaken for a measurement, and a paraphrase is exactly how that
     protection gets worn away one edit at a time. */
  surveyNotes: {
    consumerUnit: {
      oldFuseBox: "Customer indicates A, an old fuse box — confirm fuse rating, " +
        "spare capacity and condition on survey. Screening signal only, not a " +
        "settled figure. An upgrade, or an additional consumer unit alongside " +
        "the existing one, may be needed; the caveat shown with the question " +
        "has already set that expectation.",
      modernMcbRcd: "Customer indicates B, a modern consumer unit with MCBs and " +
        "RCDs — confirm fuse rating, spare capacity and condition on survey. " +
        "Screening signal only, not a settled figure.",
      modernRcbo: "Customer indicates C, a modern consumer unit with RCBOs — " +
        "confirm fuse rating, spare capacity and condition on survey. Screening " +
        "signal only, not a settled figure.",
      notSure: "Customer could not identify the electrical panel — establish " +
        "type, fuse rating, spare capacity and condition on survey."
    },
    radiatorPipework: {
      thin: "Customer indicates narrow pipework at the radiator they checked — " +
        "trace via thermal imaging with heating running to confirm standard-bore " +
        "distribution feeding reduced tails, versus microbore throughout. Where " +
        "the run isn't traceable by thermal imaging (buried in screed, fully " +
        "boxed in), this remains open pending further investigation.",
      standard: "Customer indicates standard-bore tails at the radiator they " +
        "checked. This identifies visible radiator tails only and is not " +
        "confirmation of the distribution pipework — confirm on survey.",
      notSure: "Customer could not see the radiator pipework clearly — establish " +
        "pipe sizing on survey."
    },
    epcStatus: {
      no: "No valid, in-date EPC. Boiler Upgrade Scheme grant funding requires " +
        "one, and Airwarm does not arrange or broker EPCs — raise at first " +
        "contact rather than partway through the review.",
      dontKnow: "EPC status unknown — check the public register for the address " +
        "before starting the desktop review.",
      yes: "Customer reports a valid, in-date EPC — confirm against the public " +
        "register."
    },
    insulationEvidence: {
      paperwork: "Customer holds paperwork for insulation work — request copies. " +
        "This is what turns an EPC assumption into a confirmed fact before the " +
        "desktop review is written.",
      believedNoPaperwork: "Insulation work believed done but unevidenced — " +
        "treat as assumed rather than confirmed."
    }
  }
};
/* ===================== END OF TRIAGE CONFIGURATION ====================== */


/* ==========================================================================
   Everything below this line is plumbing: showing one stage at a time,
   checking that questions have been answered, adding up the points and
   revealing the result. It contains no policy decisions.
   ========================================================================== */
(function () {
  "use strict";

  var form = document.getElementById("aw-assessment");
  if (!form) { return; }

  var stages = Array.prototype.slice.call(form.querySelectorAll(".aw-stage"));
  var totalStages = stages.length;
  var current = 0;

  var progressFill = document.getElementById("aw-progress-fill");
  var progressLabel = document.getElementById("aw-progress-label");
  var errorBox = document.getElementById("aw-form-error");
  var resultBox = document.getElementById("aw-result");

  /* The id of the validation paragraph, used to point an unanswered field's
     aria-describedby at the message about it. */
  var ERROR_ID = "aw-form-error";

  /* The answers and the result from the last time the result was rendered.
     Held only in memory, only for this page view, and only so the enquiry
     form can send them if the visitor chooses to. Never written to storage;
     closing the tab discards them. */
  var lastAnswers = null;
  var lastResult = null;

  /* ---- Marking a field as unanswered, for assistive technology ---------
     The visible message at the top of the form names the questions. These two
     helpers make the same information reachable from the field itself, which
     is what a screen-reader user gets when they tab back into it. Nothing here
     stores or sends anything. */
  function markInvalid(fields) {
    Array.prototype.forEach.call(fields, function (field) {
      field.setAttribute("aria-invalid", "true");
      var ids = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      if (ids.indexOf(ERROR_ID) === -1) { ids.push(ERROR_ID); }
      field.setAttribute("aria-describedby", ids.join(" "));
    });
  }

  function clearInvalid(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[aria-invalid="true"]'), function (field) {
      field.removeAttribute("aria-invalid");
      var ids = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (id) {
        return id && id !== ERROR_ID;
      });
      if (ids.length) {
        field.setAttribute("aria-describedby", ids.join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    });
  }

  /* ---- Showing one stage at a time ---------------------------------- */
  function showStage(index) {
    stages.forEach(function (stage, i) {
      stage.classList.toggle("is-active", i === index);
    });
    current = index;
    updateProgress();
    errorBox.textContent = "";
    clearInvalid(form);

    /* Move focus to the new stage heading so keyboard and screen-reader
       users are not left behind at the bottom of the page. */
    var heading = stages[index].querySelector("h2, h3");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  function updateProgress() {
    var pct = Math.round(((current + 1) / totalStages) * 100);
    progressFill.style.width = pct + "%";
    progressLabel.textContent = "Stage " + (current + 1) + " of " + totalStages;
  }

  /* ---- Checking the current stage is complete ------------------------
     Uses the browser's own required/validity rules so the markup stays the
     single source of truth. */
  function stageIsComplete(stage) {
    var missing = [];
    var groupsSeen = {};

    clearInvalid(stage);

    Array.prototype.forEach.call(stage.querySelectorAll("[required]"), function (field) {
      if (field.type === "radio") {
        if (groupsSeen[field.name]) { return; }
        groupsSeen[field.name] = true;
        var checked = stage.querySelector('input[name="' + field.name + '"]:checked');
        if (!checked) {
          missing.push(labelFor(field));
          markInvalid(stage.querySelectorAll('input[name="' + field.name + '"]'));
        }
      } else if (!field.value) {
        missing.push(labelFor(field));
        markInvalid([field]);
      }
    });

    return missing;
  }

  /* The name a validation message uses for a field. The field's own <label>
     comes first, so that a question inside a stage-level fieldset is named by
     its question rather than by the stage. Radio groups have no label[for], so
     they fall through to their own fieldset's <legend>, which is what names
     them. */
  function labelFor(field) {
    var lbl = field.id ? document.querySelector('label[for="' + field.id + '"]') : null;
    if (lbl) { return lbl.textContent.trim(); }
    var fs = field.closest("fieldset");
    if (fs && fs.querySelector("legend")) {
      return fs.querySelector("legend").textContent.trim();
    }
    return "a question above";
  }

  /* ---- Reading the answers ------------------------------------------ */
  function readAnswers() {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.name) { return; }
      if (field.type === "radio") {
        if (field.checked) { data[field.name] = field.value; }
      } else if (field.type === "checkbox") {
        data[field.name] = field.checked ? field.value : "";
      } else {
        data[field.name] = field.value;
      }
    });
    return data;
  }

  /* ---- Reading the answers as readable text --------------------------
     readAnswers() above returns machine values — "semiDetached", "pre1919" —
     which the scoring needs and a person reading an e-mail does not.

     This returns the same answers as the question and answer a human would
     recognise, in the order they were asked, so the enquiry e-mail can be
     read straight off a phone without anyone decoding it.

     It reads the wording out of the page rather than keeping a second copy
     of it here. Reword a question in the HTML and the e-mail follows; there
     is no list to keep in step. */
  function readTranscript() {
    var out = [];
    var groupsSeen = {};

    Array.prototype.forEach.call(form.elements, function (field) {
      if (!field.name) { return; }

      if (field.type === "radio") {
        /* One entry per group, not per option. */
        if (groupsSeen[field.name]) { return; }
        groupsSeen[field.name] = true;

        var fs = field.closest("fieldset");
        var legend = fs && fs.querySelector("legend");
        var checked = form.querySelector(
          'input[name="' + field.name + '"]:checked');

        out.push({
          question: legend ? legend.textContent.trim() : field.name,
          /* The radio sits inside its own <label>, so the label's text minus
             nothing else is the answer as the visitor read it. */
          answer: checked && checked.parentNode
            ? checked.parentNode.textContent.trim()
            : "(not answered)"
        });
        return;
      }

      if (field.tagName === "SELECT") {
        var opt = field.options[field.selectedIndex];
        out.push({
          question: labelFor(field),
          answer: opt && opt.value ? opt.text.trim() : "(not answered)"
        });
        return;
      }

      if (field.type === "text" || field.type === "email" || field.type === "tel") {
        out.push({
          question: labelFor(field),
          answer: field.value.trim() || "(not answered)"
        });
      }
    });

    return out;
  }

  /* ---- The reference shown to the customer and quoted in the e-mail ---
     Format: HOUSE-POSTCODE-DDMMYYYY, e.g. 379-BD4-9JL-27082026.

     It replaced a random six-character code (AW-4K2P9C) in September 2026.
     The random version was unambiguous but meant nothing to anybody: a
     customer ringing up could quote it and still have to spell out their
     address before they could be found, and the person searching the inbox
     had no way to guess it from what they already knew.

     This one is derived entirely from information already in the enquiry, so
     it can be reconstructed from either end of the conversation. Someone who
     has lost the e-mail can still be found from their address and the day
     they sent it.

     It identifies nothing on its own and nothing is stored against it. It is
     a label for a conversation, not a key and not a secret — which is also
     why it is safe for it to be guessable.

     Two enquiries from the same property on the same day produce the same
     reference. That is deliberate: they are the same conversation, and
     appending a counter would need state this form does not have. */
  /* Reads one property select. Returns the raw value — "4", "moreThan12" or
     "notSure" — and leaves the wording to whatever displays it, so the e-mail
     template can phrase it for a person without this having an opinion. */
  function readPropertyField(id) {
    var el = document.getElementById(id);
    return el ? el.value : "notSure";
  }

  function makeReference(address, postcode, when) {
    return [
      houseIdentifier(address),
      formatPostcodeForReference(postcode),
      formatReferenceDate(when)
    ].join("-");
  }

  /* The house number, or the best available stand-in.

     Most UK addresses start with a number, sometimes with a letter attached
     (12A) — that is what the first branch catches, including the "Flat 2, 14
     Mill Lane" case where the first number found is the flat rather than the
     building. That is fine: the reference only has to be recognisable, not
     correct, and a person reading it alongside the full address will not be
     confused.

     Named properties have no number at all. Rather than fail the form or
     invent a number, fall back to the first word of the address — "Rose
     Cottage" becomes ROSE — which is still recognisable to the person
     handling it. NOHSE is the last resort if the address is unusable. */
  function houseIdentifier(address) {
    var text = String(address || "").trim();

    var number = text.match(/\d+[A-Za-z]?/);
    if (number) { return number[0].toUpperCase(); }

    var word = text.match(/[A-Za-z]+/);
    if (word) { return word[0].toUpperCase().slice(0, 12); }

    return "NOHSE";
  }

  /* BD4 9JL -> BD4-9JL.

     The specification asks for the space removed and hyphens used as the
     separator, so the space becomes a hyphen. UK postcodes always end in
     digit-letter-letter, so splitting three from the right gets the outward
     and inward halves without needing to know the (many) outward formats.

     A postcode too short to split is passed through as typed rather than
     mangled — a typo should still produce a usable reference. */
  function formatPostcodeForReference(postcode) {
    var clean = String(postcode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 5) { return clean || "NOPC"; }
    return clean.slice(0, clean.length - 3) + "-" + clean.slice(-3);
  }

  /* DDMMYYYY, in the customer's own timezone.

     Local rather than UTC on purpose: someone submitting at half past midnight
     UK time in summer should get the date they saw on their own clock, not
     yesterday's. */
  function formatReferenceDate(when) {
    var d = when || new Date();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear();
  }

  /* ---- Survey notes for the person doing the review -------------------
     Turns the intake answers into the handling language the specification
     asks for, for the enquiry e-mail only.

     These are NOT shown to the visitor and must not be. They are written for
     an engineer deciding what to check on site, and read as alarming or
     baffling to a homeowner who has just been told their home looks
     promising. The result panel is built in renderResult(); nothing here goes
     near it.

     Nothing is invented at this point either — every sentence comes from the
     surveyNotes table in the config above. This function only decides which
     ones apply. */
  function buildSurveyNotes(answers) {
    var table = AIRWARM_TRIAGE_CONFIG.surveyNotes;
    var notes = [];

    AIRWARM_TRIAGE_CONFIG.nonScoringIntakeFields.forEach(function (field) {
      var given = answers[field];
      if (!given || !table[field]) { return; }
      if (Object.prototype.hasOwnProperty.call(table[field], given)) {
        notes.push(table[field][given]);
      }
    });

    return notes;
  }

  /* ---- Why the result came out the way it did --------------------------
     Builds the "Why you got this result" list. Every entry is tied to one
     answer the visitor gave, and to the rule or the points that answer
     contributed: the cap rules that fired, then each answer that scored below
     the best answer to its question and has an entry in resultReasons.

     Returns { field, value, kind, text } objects in question order. One entry
     per question at most. */
  function collectReasons(answers, cappedRules) {
    var cfg = AIRWARM_TRIAGE_CONFIG;
    var out = [];
    var covered = {};

    cappedRules.forEach(function (rule) {
      covered[rule.field] = true;
      out.push({ field: rule.field, value: rule.value, kind: rule.kind, text: rule.explanation });
    });

    Object.keys(cfg.answerPoints).forEach(function (field) {
      if (covered[field]) { return; }
      var given = answers[field];
      var points = cfg.answerPoints[field];
      var table = cfg.resultReasons[field];
      if (!given || !table || !Object.prototype.hasOwnProperty.call(table, given)) { return; }
      if (!Object.prototype.hasOwnProperty.call(points, given)) { return; }

      var best = Math.max.apply(null, Object.keys(points).map(function (k) { return points[k]; }));
      if (points[given] >= best) { return; }

      out.push({ field: field, value: given, kind: table[given].kind, text: table[given].text });
    });

    return out;
  }

  /* ---- Applying the placeholder logic -------------------------------- */
  function assess(answers) {
    var cfg = AIRWARM_TRIAGE_CONFIG;
    var score = 0;

    Object.keys(cfg.answerPoints).forEach(function (field) {
      var given = answers[field];
      var table = cfg.answerPoints[field];
      if (given && Object.prototype.hasOwnProperty.call(table, given)) {
        score += table[given];
      }
    });

    /* Rank the three outcomes so a cap can only ever move the result down. */
    var order = ["notCurrently", "potentially", "likely"];
    var outcome = "notCurrently";
    if (score >= cfg.outcomeThresholds.likelySuitableMinimumScore) {
      outcome = "likely";
    } else if (score >= cfg.outcomeThresholds.potentiallySuitableMinimumScore) {
      outcome = "potentially";
    }

    var capped = [];
    cfg.constraintsThatCapTheOutcome.forEach(function (rule) {
      if (answers[rule.field] !== rule.value) { return; }
      if (rule.requiresAlso && answers[rule.requiresAlso.field] !== rule.requiresAlso.value) {
        return;
      }
      capped.push(rule);
      if (order.indexOf(rule.capAt) < order.indexOf(outcome)) {
        outcome = rule.capAt;
      }
    });

    var reasons = collectReasons(answers, capped);

    /* AMBER NEEDS A KNOWN CONSTRAINT. Added 15 Sep 2026.
       AMBER means the visitor's answers identified a significant known
       constraint, and it has to name that constraint. A low score made up of
       "Not sure" answers and small shortfalls has not identified one: it has
       identified things to check, which is what BLUE means. So when the
       score alone would give AMBER but no answer is a constraint, the result
       is BLUE instead. The score and the thresholds are untouched; this only
       stops AMBER being shown without a reason that could justify it. */
    var hasConstraint = reasons.some(function (r) { return r.kind === "constraint"; });
    if (outcome === "notCurrently" && !hasConstraint) {
      outcome = "potentially";
    }

    /* Service-area note only. This never changes the outcome. */
    var outward = (answers.postcodeArea || "").trim().toUpperCase();
    var prefix = outward.replace(/[^A-Z]/g, "").slice(0, 2);
    var inServiceArea = cfg.serviceAreaOutwardPrefixes.indexOf(prefix) !== -1;

    /* How many questions were answered "not sure". This does NOT affect the
       outcome. It is only used to explain the result honestly: someone who
       does not know much about their own house should be told that the answer
       reflects missing information rather than a fault with their property.

       Only the SCORED questions count. The intake questions added in August
       2026 have "not sure" options of their own, and counting those would
       mean someone who could not identify their fuse box got told that
       missing information was holding their result back — when that answer
       had no bearing on the result at all. The threshold in renderResult is
       three, so two new fields alone could have flipped that message. */
    var notSureCount = 0;
    Object.keys(answers).forEach(function (field) {
      if (cfg.nonScoringIntakeFields.indexOf(field) !== -1) { return; }
      if (answers[field] === "notSure") { notSureCount += 1; }
    });

    return {
      outcome: outcome,
      score: score,
      reasons: reasons,
      notSureCount: notSureCount,
      inServiceArea: inServiceArea || outward === ""
    };
  }

  /* ---- The outcome copy ---------------------------------------------
     GREEN is the approved wording from Result_Copy.md and is deliberately
     unchanged. BLUE and AMBER follow Tom's action plan of 15 Sep 2026.

     `why` introduces the "Why you got this result" list and `after` closes
     it. GREEN has neither: it does not get a reasons list. */
  var OUTCOME_COPY = {
    likely: {
      className: "aw-outcome--likely",
      heading: "Your home shows several positive indicators",
      body: "Based on your answers, there are no obvious reasons at this " +
        "stage why a heat pump would not be worth investigating further."
    },
    potentially: {
      className: "aw-outcome--potentially",
      heading: "There are a few things we would want to understand better",
      body: "Nothing in your answers rules a heat pump out, but some of them " +
        "leave questions we would want to answer before recommending a " +
        "survey.",
      why: "These are the answers that need a closer look. Where you " +
        "answered &ldquo;Not sure&rdquo;, that is treated as something to " +
        "check, not as a problem with your home.",
      after: "None of these is a reason to rule out a heat pump. They are " +
        "exactly what our Desktop Review investigates."
    },
    notCurrently: {
      className: "aw-outcome--not-currently",
      heading: "Your answers have identified some significant issues",
      body: "Based on the information you have given, one or more of your " +
        "answers point to issues that could make a heat pump installation " +
        "difficult or unsuitable.",
      why: "These are the answers that led to this result:",
      after: "This does not prove that a heat pump could never work at your " +
        "property. This online assessment is not a final engineering " +
        "judgement. But based on the information you have given so far, we " +
        "would not recommend progressing to the next stage."
    }
  };

  /* The invitation that sits directly above the form, for the two results
     that get one. AMBER deliberately has no entry: an AMBER result must not
     invite the visitor to submit for a Desktop Review, so renderResult does
     not mount the form for it at all. */
  var NEXT_STEP = {
    likely: {
      heading: "Want us to take a closer look?",
      body: "Send us your details below and we will review your property " +
        "alongside your answers and available public property information. " +
        "We will come back to you with what we have found and whether we " +
        "think a heat-loss survey is worthwhile."
    },
    potentially: {
      heading: "Send us your assessment and we will look into it",
      body: "Send us your details below and we will investigate the points " +
        "above in a Desktop Review, alongside your answers and available " +
        "public property information. We will come back to you in writing " +
        "with what we have found and whether a heat-loss survey is worthwhile."
    }
  };

  /* ==================================================================
     THE ENQUIRY FORM
     The only part of this site that collects personal data. Read the
     ENQUIRY_ENDPOINT comment at the top of this file before changing
     anything here.

     Accessibility is not optional in this block. The requirements are
     WCAG 2.2 AA obligations, and they are also written down in the
     comment on /contact/:
       - a real <label for="..."> on every field, never a placeholder
       - the group in a <fieldset> with a <legend>
       - autocomplete on name, email and tel so browsers can fill them
       - validation messages that name the field and are tied to it with
         aria-describedby and aria-invalid
       - no meaning carried by colour alone
     ================================================================== */

  var ENQUIRY_ERROR_ID = "aw-enquiry-error";

  /* Every field: id, label, input type, autocomplete token, and whether it
     is required. Kept as data so the markup, the validation and the payload
     cannot drift apart — add a field here and all three follow. */
  var ENQUIRY_FIELDS = [
    { id: "enqName", label: "Your name", type: "text",
      autocomplete: "name", required: true },
    { id: "enqAddress", label: "Property address", type: "text",
      autocomplete: "street-address", required: true,
      hint: "The property the assessment was about, if it is not where you live." },
    { id: "enqPostcode", label: "Postcode", type: "text",
      autocomplete: "postal-code", required: true },
    { id: "enqEmail", label: "E-mail address", type: "email",
      autocomplete: "email", required: true },
    { id: "enqPhone", label: "Telephone number", type: "tel",
      autocomplete: "tel", required: true,
      hint: "For arranging a survey, or if we need to clarify something later." }
  ];

  /* Property facts for the Desktop Review, added September 2026 (SEPT-001).

     These exist because the submission e-mail is the working input to the
     Desktop Review, not just a lead notification: whoever picks it up needs
     to know roughly what size of system is being talked about before they
     ring anybody.

     They are deliberately NOT assessment questions. They are asked after the
     result, they carry no score, and nothing here can change whether a home
     came out as suitable. Two reasons. The triage questionnaire is already at
     the upper limit of what someone will sit through, and — more
     importantly — a homeowner guessing at a radiator count is not evidence
     about their property. It is a starting point for a survey.

     Hence the default of "Not sure", which follows the rule set for the whole
     assessment:

         NOT SURE = UNKNOWN / ENGINEER CHECK

     Not knowing is a normal answer from someone who has never had to count.
     It must never read as a wrong one, and must never count against them. */
  var PROPERTY_FIELDS = [
    {
      id: "enqOccupants",
      label: "How many people live in the property?",
      hint: "Roughly is fine. It affects how much hot water a system needs to provide.",
      max: 8
    },
    {
      id: "enqRooms",
      label: "How many rooms does the property have?",
      hint: "Count the rooms you heat, including the kitchen and bathroom.",
      max: 12
    },
    {
      id: "enqRadiators",
      label: "How many radiators are there?",
      hint: "A rough count from memory is genuinely useful. Include towel rails.",
      max: 15,
      allowZero: true
    }
  ];

  /* One <select> per property field.

     A select rather than a number input: it cannot be given nonsense, it needs
     no validation message, and on a phone it opens a picker instead of a
     keyboard. "Not sure" is the initial value, so leaving the section
     untouched submits an honest answer rather than an empty one. */
  function buildPropertyFields() {
    var html = "";

    html += '<fieldset class="aw-fieldset"><legend>About the property</legend>';
    html += '<p class="aw-small">These help us picture the property before we ' +
      "reply. Answer what you know and leave the rest as " +
      "<strong>Not sure</strong> &mdash; none of it changes your result above.</p>";

    PROPERTY_FIELDS.forEach(function (field) {
      var hintId = field.id + "-hint";
      html += '<div class="aw-field">';
      html += '<label for="' + field.id + '">' + field.label + "</label>";
      html += '<span class="aw-field__hint" id="' + hintId + '">' +
        field.hint + "</span>";
      html += '<select id="' + field.id + '" name="' + field.id +
        '" aria-describedby="' + hintId + '">';

      var start = field.allowZero ? 0 : 1;
      for (var n = start; n <= field.max; n++) {
        html += '<option value="' + n + '">' + n + "</option>";
      }
      html += '<option value="moreThan' + field.max + '">More than ' +
        field.max + "</option>";

      /* Last in the list but selected, so the control reads "Not sure" before
         anyone touches it while the numbers stay in their natural order. */
      html += '<option value="notSure" selected>Not sure</option>';
      html += "</select>";
      html += "</div>";
    });

    html += "</fieldset>";
    return html;
  }

  /* Household needs, added 15 Sep 2026 from the post-Ample action plan.

     Asked here, in the form that requests a Desktop Review, because this is
     the first point at which the visitor is asking Airwarm to start planning
     real work at their property. It is NOT an assessment question: it lives
     outside the scored form, it is not in answerPoints, and nothing here can
     change the result.

     An answer of "yes", or anything typed in the details box, can be health
     information, which is special category data under UK GDPR. The general
     consent box below does not cover it, so this has its own unticked box,
     required only when something sensitive has actually been given. The
     privacy policy's assessment-form section describes this; keep the two in
     step. No internal classification is shown to the visitor. */
  function buildHouseholdNeedsFields() {
    var html = "";
    html += '<fieldset class="aw-fieldset">';
    html += "<legend>Is there anyone at the property whose age, health, " +
      "mobility or reliance on heating, hot water or essential equipment " +
      "means we should take additional care when planning the work?</legend>";
    html += '<span class="aw-field__hint">Optional. This does not affect ' +
      "your result. It helps us plan visits and any time without heating or " +
      "hot water around the people who live there.</span>";
    [["yes", "Yes"], ["no", "No"], ["notSure", "Not sure"]].forEach(function (o) {
      html += '<label class="aw-choice"><input type="radio" ' +
        'name="enqHouseholdNeeds" value="' + o[0] + '"> ' + o[1] + "</label>";
    });
    html += '<div class="aw-field">';
    html += '<label for="enqHouseholdDetails">Anything you would like us to ' +
      "know (optional)</label>";
    html += '<span class="aw-field__hint" id="enqHouseholdDetails-hint">A ' +
      "short note is plenty. Only tell us what you are comfortable sharing.</span>";
    html += '<textarea id="enqHouseholdDetails" name="enqHouseholdDetails" ' +
      'maxlength="500" aria-describedby="enqHouseholdDetails-hint"></textarea>';
    html += "</div>";
    html += '<div class="aw-consent">';
    html += '<input type="checkbox" id="enqHouseholdConsent" name="enqHouseholdConsent">';
    html += '<label for="enqHouseholdConsent">If I have answered yes or added ' +
      "details, I agree Airwarm may record that information and use it only " +
      "to plan the work safely. I can ask for it to be removed at any time.</label>";
    html += "</div>";
    html += "</fieldset>";
    return html;
  }

  /* The household-needs answer for the payload. Details are sent only with
     the explicit consent box ticked; submitEnquiry refuses to send before
     that point, so this never has to drop anything silently. */
  function readHouseholdNeeds() {
    var checked = document.querySelector('input[name="enqHouseholdNeeds"]:checked');
    var detailsEl = document.getElementById("enqHouseholdDetails");
    var consentEl = document.getElementById("enqHouseholdConsent");
    return {
      answer: checked ? checked.value : "notAnswered",
      details: detailsEl ? detailsEl.value.trim() : "",
      explicitConsent: !!(consentEl && consentEl.checked)
    };
  }

  function buildEnquiryForm(outcome) {
    var html = "";
    /* The invitation changes with the route; everything below it does not.
       Same form, same button, same journey — see NEXT_STEP. */
    var step = NEXT_STEP[outcome] || NEXT_STEP.potentially;

    html += '<div class="aw-enquiry">';
    html += '<h4 id="aw-enquiry-heading">' + step.heading + "</h4>";
    html += "<p>" + step.body + "</p>";
    html += '<p><strong>You decide whether to go any further.</strong></p>';

    html += '<form id="aw-enquiry-form" novalidate aria-labelledby="aw-enquiry-heading">';

    /* The validation summary. Empty until something is wrong; aria-live so a
       screen reader announces it without moving focus unexpectedly. */
    html += '<p class="aw-form__error" id="' + ENQUIRY_ERROR_ID +
      '" role="status" aria-live="polite"></p>';

    html += '<fieldset class="aw-fieldset"><legend>Your details</legend>';

    ENQUIRY_FIELDS.forEach(function (field) {
      var describedBy = field.hint ? field.id + "-hint" : "";
      html += '<div class="aw-field">';
      html += '<label for="' + field.id + '">' + field.label + "</label>";
      if (field.hint) {
        html += '<span class="aw-field__hint" id="' + field.id + '-hint">' +
          field.hint + "</span>";
      }
      html += '<input type="' + field.type + '" id="' + field.id +
        '" name="' + field.id + '"' +
        ' autocomplete="' + field.autocomplete + '"' +
        (describedBy ? ' aria-describedby="' + describedBy + '"' : "") +
        (field.required ? " required" : "") + ">";
      html += "</div>";
    });

    html += "</fieldset>";

    /* Property facts for the Desktop Review — see PROPERTY_FIELDS. Placed
       after the contact details because they are the less important half:
       an enquiry with no radiator count is still a usable enquiry. */
    html += buildPropertyFields();

    html += buildHouseholdNeedsFields();

    /* PREFERRED CONTACT METHOD REMOVED, 20 Aug 2026. It asked the customer to
       choose between e-mail and a telephone call at the exact point in the
       journey where neither is a stage any more: the answer comes back as a
       written review. The payload still carries preferredContact so the
       endpoint and the e-mail template keep working — see submitEnquiry. */

    /* ---- Spam protection ------------------------------------------------
       A honeypot: a field a person never sees and never fills, which bots
       fill because they complete every input they find. Hidden from
       assistive technology too, so a screen-reader user is not asked to
       complete a field that must stay empty.

       Deliberately NOT a third-party CAPTCHA. Those load code from another
       company, profile the visitor, and would make the cookie policy and
       the "no third-party requests" claim false. This costs nothing and
       stops the overwhelming majority of automated submissions. If real
       spam gets through, add a server-side rate limit at the endpoint
       before reaching for anything that tracks people. */
    html += '<div class="aw-hp" aria-hidden="true">';
    html += '<label for="enqWebsite">Website</label>';
    html += '<input type="text" id="enqWebsite" name="enqWebsite" tabindex="-1" autocomplete="off">';
    html += "</div>";

    /* ---- Consent --------------------------------------------------------
       Unticked, its own <label>, and specific about what is being agreed
       to. UK GDPR Article 7 wants consent to be a clear affirmative act and
       as easy to withdraw as to give, which is why the withdrawal route is
       stated right here rather than only in the policy. */
    html += '<div class="aw-consent">';
    html += '<input type="checkbox" id="enqConsent" name="enqConsent">';
    html += '<label for="enqConsent">Airwarm may hold these details and my ' +
      "assessment answers, look up available public property information for " +
      "this address, and use them to review my property and reply to me. I " +
      "can withdraw this at any time by e-mailing " +
      "<strong>hello@airwarm.co.uk</strong>.</label>";
    html += "</div>";

    html += '<p class="aw-small">We keep enquiries for 12 months from our ' +
      "last contact if they do not lead to work, then delete them. We will " +
      "not add you to a mailing list. The full detail is in our " +
      '<a href="../privacy/">privacy policy</a>.</p>';

    html += '<div class="aw-btn-row" style="margin-top:24px">';
    html += '<button type="submit" class="aw-btn aw-btn--primary" id="aw-enquiry-submit">' +
      "Send this to Airwarm</button>";
    html += "</div>";

    html += "</form>";
    html += "</div>";

    return html;
  }

  /* Validates, then makes the single network request in this file.
     `answers` is the assessment data already in memory; it is sent alongside
     the contact details so the reply can be about the actual property. */
  function submitEnquiry(formEl, answers, result) {
    var errorEl = document.getElementById(ENQUIRY_ERROR_ID);
    var consent = document.getElementById("enqConsent");
    var honeypot = document.getElementById("enqWebsite");
    var missing = [];
    var invalidFields = [];

    clearInvalid(formEl);
    errorEl.textContent = "";

    ENQUIRY_FIELDS.forEach(function (field) {
      var el = document.getElementById(field.id);
      if (field.required && !el.value.trim()) {
        missing.push(field.label);
        invalidFields.push(el);
      }
    });

    /* A deliberately forgiving e-mail check. The only thing worth rejecting
       here is an address that obviously cannot work; anything stricter
       turns away real people with unusual addresses. */
    var emailEl = document.getElementById("enqEmail");
    if (emailEl.value.trim() && emailEl.value.indexOf("@") === -1) {
      missing.push("a working e-mail address");
      invalidFields.push(emailEl);
    }

    if (missing.length) {
      errorEl.textContent = "Please add " + listToSentence(missing) +
        " so we can reply to you.";
      markInvalid(invalidFields);
      invalidFields[0].focus();
      return;
    }

    /* Consent is checked separately and after the fields, so the message can
       be about consent specifically rather than buried in a list. */
    if (!consent.checked) {
      errorEl.textContent = "Please tick the box to confirm Airwarm may hold " +
        "these details, so we know we have your permission.";
      markInvalid([consent]);
      consent.focus();
      return;
    }

    /* Household needs: sensitive information needs its own consent. Checked
       after the general consent so each message is about one thing. */
    var household = readHouseholdNeeds();
    if ((household.answer === "yes" || household.details) && !household.explicitConsent) {
      var householdConsent = document.getElementById("enqHouseholdConsent");
      errorEl.textContent = "You have told us about someone at the property " +
        "who may need extra care. Please tick the box to say we may record " +
        "that, or clear the answer if you would rather not share it.";
      markInvalid([householdConsent]);
      householdConsent.focus();
      return;
    }

    /* Read these before the honeypot check: the reference is now derived from
       the address, postcode and date rather than generated at random, so both
       the real path and the bot path need them. */
    var submittedAt = new Date();
    var addressValue = document.getElementById("enqAddress").value.trim();
    var postcodeValue = document.getElementById("enqPostcode").value.trim();
    var reference = makeReference(addressValue, postcodeValue, submittedAt);

    /* Honeypot filled means an automated submission. Show the same success
       state rather than an error: telling a bot it failed only teaches it to
       try again. Nothing is sent. */
    if (honeypot.value) {
      showEnquirySent(formEl, reference);
      return;
    }

    var payload = {
      reference: reference,
      submittedAt: submittedAt.toISOString(),
      submittedAtLocal: submittedAt.toString(),
      name: document.getElementById("enqName").value.trim(),
      address: addressValue,
      /* The house number on its own, as SEPT-008 asks for it in the case
         record. Same value the reference is built from, sent rather than
         recomputed at the endpoint so the two can never disagree. */
      houseNumber: houseIdentifier(addressValue),
      postcode: postcodeValue,
      email: emailEl.value.trim(),
      telephone: document.getElementById("enqPhone").value.trim(),
      /* The customer is no longer asked to pick. The field stays in the
         payload with a neutral value so the endpoint's validation and the
         e-mail template keep working unchanged — removing it from the wire
         format would mean redeploying the Apps Script to fix a line that
         reads "Prefers: no preference given" either way. */
      preferredContact: "noPreference",
      consentGiven: true,
      consentAt: submittedAt.toISOString(),
      /* Property facts (SEPT-001). Kept as their own block, deliberately
         apart from `answers` and `assessmentScore`: these were never scored
         and must not look as though they were to anyone reading the e-mail
         or re-running the triage later. "notSure" means unknown, not no. */
      property: {
        occupants: readPropertyField("enqOccupants"),
        rooms: readPropertyField("enqRooms"),
        radiators: readPropertyField("enqRadiators")
      },
      /* Household needs (15 Sep 2026). Its own block, like `property`: not
         scored, not part of `answers`. See buildHouseholdNeedsFields. */
      householdNeeds: household,
      assessmentOutcome: result.outcome,
      assessmentOutcomeLabel: AIRWARM_TRIAGE_CONFIG.outcomeLabels[result.outcome],
      assessmentScore: result.score,
      /* The "Why you got this result" lines exactly as the visitor saw them,
         so the Desktop Review starts from the same list. GREEN shows none. */
      resultReasonsShown: result.outcome === "potentially"
        ? result.reasons.map(function (r) { return r.text; })
        : [],
      /* The readable question-and-answer transcript. `answers` keeps the raw
         machine values alongside it, because those are what any later
         re-scoring would need. */
      transcript: readTranscript(),
      answers: answers,
      /* What the intake answers mean for the survey. Internal handling
         language — see buildSurveyNotes. The visitor never sees these. */
      surveyNotes: buildSurveyNotes(answers)
    };

    var submitBtn = document.getElementById("aw-enquiry-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    /* The body is JSON, but the Content-Type is deliberately text/plain.

       application/json makes this a "preflighted" cross-origin request: the
       browser sends an OPTIONS request first and refuses to POST unless that
       is answered with the right CORS headers. text/plain keeps it a simple
       request, which skips the preflight entirely. The receiving end parses
       the string as JSON, so nothing is lost.

       This matters because the endpoint is a Google Apps Script web app,
       which cannot answer an OPTIONS preflight. If you move to an endpoint
       that can, application/json is the tidier choice — change it here and
       in the receiving code together. */
    fetch(ENQUIRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) { throw new Error("HTTP " + response.status); }
      showEnquirySent(formEl, reference);
    }).catch(function () {
      /* Never lose the enquiry silently. The person has typed their details
         and is entitled to know it did not arrive, plus a route that works. */
      submitBtn.disabled = false;
      submitBtn.textContent = "Send this to Airwarm";
      errorEl.innerHTML = "That did not send, and we would rather tell you " +
        "than pretend. Please try again, or e-mail " +
        '<a href="mailto:hello@airwarm.co.uk">hello@airwarm.co.uk</a> or ' +
        'call <a href="tel:+441274947197">01274 947 197</a> ' +
        "&mdash; your answers are still on this page.";
      errorEl.focus();
    });
  }

  function showEnquirySent(formEl, reference) {
    var sent = document.createElement("div");
    sent.className = "aw-enquiry-sent";
    sent.setAttribute("role", "status");
    sent.setAttribute("tabindex", "-1");
    sent.innerHTML = "<h4>Thank you &mdash; we will take it from here</h4>" +
      "<p>Your assessment is with us. We will review your property alongside " +
      "the answers you have given, and send you a written explanation of " +
      "what we have found and whether a survey is worth doing. There is " +
      "nothing else you need to do for now, and no call to sit through " +
      "&mdash; you decide what happens next.</p>" +
      /* The reference is shown so someone can quote it if they ring before
         we have replied. It is a label for a conversation, not a lookup
         key — nothing is stored against it. */
      '<p class="aw-small">Your reference is <strong>' + reference +
      "</strong>. Quote it if you contact us before we get back to you.</p>" +
      /* No "call us if you need us sooner" here. It invites a chase on a
         journey whose whole point is that the customer does not have to
         phone anybody, and it sat oddly beside "there is nothing else you
         need to do". The number is on /contact/ and in the footer. */
      '<p class="aw-small">We normally reply within 2 working days.</p>' +
      /* Pre-launch progression, per the 15 Sep 2026 action plan. Sending the
         assessment does not book anything, but it is not a dead end until
         April 2027 either: reviews, surveys and design happen now. */
      '<p class="aw-small">Installations begin in April 2027. Desktop ' +
      "Reviews, heat-loss surveys and system design are happening now, so " +
      "if your home is suitable you can plan and book an installation for " +
      "the launch period. Sending this does not book an installation.</p>";
    formEl.parentNode.replaceChild(sent, formEl);
    sent.focus();
  }

  /* "a, b and c" — used in validation messages so they read like a sentence
     rather than a list of field names. */
  function listToSentence(items) {
    if (items.length === 1) { return items[0]; }
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function renderResult(result) {
    var copy = OUTCOME_COPY[result.outcome];
    var label = AIRWARM_TRIAGE_CONFIG.outcomeLabels[result.outcome];

    var html = '<div class="aw-outcome ' + copy.className + '">';
    html += '<span class="aw-outcome__label">' + label + "</span>";
    html += "<h3>" + copy.heading + "</h3>";
    html += "<p>" + copy.body + "</p>";

    /* WHY YOU GOT THIS RESULT — BLUE and AMBER only.
       Every line comes from result.reasons, which collectReasons() builds
       from the visitor's own answers and the rule or points each answer
       contributed. There is no generic list to fall back on, on purpose.
       AMBER shows only the constraints: the uncertainties are real, but they
       are not what made the result AMBER. assess() guarantees AMBER always
       has at least one constraint and BLUE at least one reason. */
    var isAmber = result.outcome === "notCurrently";
    var shown = result.outcome === "likely" ? [] : result.reasons.filter(function (r) {
      return !isAmber || r.kind === "constraint";
    });
    if (shown.length) {
      html += "<h4>Why you got this result</h4>";
      html += "<p>" + copy.why + "</p>";
      html += '<ul class="aw-ticks">';
      shown.forEach(function (reason) {
        html += "<li>" + reason.text + "</li>";
      });
      html += "</ul>";
      html += "<p>" + copy.after + "</p>";
    }

    if (!result.inServiceArea) {
      html += "<p class=\"aw-small\">Your postcode area looks as though it " +
        "may be outside the Bradford, Leeds and Shipley area Airwarm is " +
        "starting with." +
        (isAmber ? "" : " Send your details anyway &mdash; we will tell you " +
          "straight away whether we can help.") + "</p>";
    }

    /* NO COMPETING CONTACT CTAs HERE. This card used to end with an
       block offering an e-mail button and a telephone button beside the
       form, under a heading inviting people to contact us instead.

       The visitor has just answered twenty questions. The one useful next
       action is to send them, and putting two other routes next to that
       button only asks them to choose again. The number and the address are
       still on /contact/ and in the footer of this page — they are simply not
       competing with the form at this point in the journey.

       Do not add a mailto or a tel: link back into this function. */

    html += '<p class="aw-small" style="margin-top:24px">This result is an ' +
      "indicative first step produced from your answers. It is not a " +
      "technical heat-loss survey and it is not a final decision" +
      (isAmber ? ".</p>" : " &mdash; a person at Airwarm makes that " +
        "judgement, and will explain the reasoning either way.</p>");

    /* This sentence is a privacy claim, so it has to track what the page
       actually does. Unconfigured, or on AMBER where no form is shown,
       nothing can be transmitted at all. With the form present, the answers
       are still local until the visitor submits it — which is a different
       promise, and worth stating exactly. */
    if (ENQUIRY_ENDPOINT && !isAmber) {
      html += '<p class="aw-small">Your answers are still on your device. ' +
        "They reach Airwarm only if you fill in the form below and send it. " +
        "Closing this page without sending discards everything.</p>";
    } else {
      html += '<p class="aw-small">Your answers have not been sent anywhere. ' +
        "Nothing you typed has left this device or been stored. Closing this " +
        "page discards it.</p>";
    }

    html += "</div>";

    resultBox.innerHTML = html;
    resultBox.classList.remove("aw-hidden");

    /* ---- WIRE-UP POINT ------------------------------------------------
       The ONLY place in the site where contact details are collected or
       transmitted. Adding a second one makes the privacy policy untrue —
       extend this instead.

       The form renders only when ENQUIRY_ENDPOINT (top of this file) is set;
       unconfigured, the visitor gets the e-mail and telephone route and
       nothing is collected.

       It mounts OUTSIDE the assessment form, into #aw-enquiry-mount, because
       HTML forbids nested forms — injected inside the result panel the
       browser silently drops the <form> tag, leaving fields with no form
       around them and a send button that does nothing at all. Do not move
       this back into resultBox.
       ------------------------------------------------------------------ */
    var mount = document.getElementById("aw-enquiry-mount");
    if (mount) {
      /* AMBER gets no form, and the mount is emptied rather than left alone:
         someone who saw BLUE, went back and changed an answer to reach AMBER
         must not still have the BLUE invitation sitting under the result. */
      mount.innerHTML = ENQUIRY_ENDPOINT && NEXT_STEP[result.outcome]
        ? buildEnquiryForm(result.outcome)
        : "";
    }
  }

  /* ---- Buttons ------------------------------------------------------- */
  form.addEventListener("click", function (event) {
    var next = event.target.closest("[data-aw-next]");
    var back = event.target.closest("[data-aw-back]");

    if (next) {
      event.preventDefault();
      var missing = stageIsComplete(stages[current]);
      if (missing.length) {
        errorBox.textContent = missing.length === 1
          ? "Please answer: " + missing[0]
          : "Please answer these questions before continuing: " + missing.join("; ");
        errorBox.focus();
        return;
      }
      if (current < totalStages - 1) {
        /* The final stage shows the result, so work it out on the way in.
           The answers and the result are kept in scope because the enquiry
           form sends them alongside the contact details — the whole point is
           that the reply is about the actual property, not a generic one. */
        if (current === totalStages - 2) {
          lastAnswers = readAnswers();
          lastResult = assess(lastAnswers);
          renderResult(lastResult);
        }
        showStage(current + 1);
      }
    }

    if (back) {
      event.preventDefault();
      if (current > 0) { showStage(current - 1); }
    }
  });

  /* The assessment form itself is never submitted. If a browser or a stray
     Enter key tries, stop it here. The enquiry form is a separate <form>
     inside the result panel and has its own handler below. */
  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  /* ---- The enquiry form ----------------------------------------------
     Delegated from the mount point, because the form does not exist in the
     document until a result has been rendered. This is the only listener in
     the file that can cause a network request. */
  var enquiryMount = document.getElementById("aw-enquiry-mount");
  if (enquiryMount) {
    enquiryMount.addEventListener("submit", function (event) {
      var enquiryForm = event.target.closest("#aw-enquiry-form");
      if (!enquiryForm) { return; }
      event.preventDefault();
      submitEnquiry(enquiryForm, lastAnswers, lastResult);
    });
  }

  /* Start on stage one with the progress indicator in step. */
  showStage(0);
}());
