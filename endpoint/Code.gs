/**
 * AIRWARM — enquiry form endpoint
 * =============================================================================
 * Receives the Home Energy Assessment enquiry form and e-mails it to Airwarm.
 *
 * WHAT THIS IS
 * A Google Apps Script web app. It runs inside the Airwarm Google Workspace
 * account, receives the form POST, and sends one e-mail. That is all it does.
 *
 * WHY THIS RATHER THAN A FORM SERVICE
 * The privacy policy at /privacy/ says the form "sends us an e-mail and
 * nothing else. There is no database, no customer relationship system and no
 * third-party dashboard holding a list of enquiries."
 *
 * That sentence is only true if the receiving end keeps no copy. A hosted form
 * service stores every submission in its own dashboard, which would make it a
 * processor under UK GDPR — it would have to be named in the policy, given a
 * data-processing agreement, and included in any deletion request. Running it
 * here keeps the enquiry inside Google Workspace, which the policy ALREADY
 * names as Airwarm's processor. No new vendor, no policy change.
 *
 * THE RULE THIS FILE EXISTS TO PROTECT
 * Do not add storage. No Sheet, no Drive file, no Properties entry, no
 * console.log of the payload. The moment this writes an enquiry anywhere
 * other than the outbound e-mail, the privacy policy becomes false and has to
 * be rewritten before the change ships.
 *
 * DEPLOYMENT
 * See endpoint/README.md in this repository.
 * =============================================================================
 */

/** Where enquiries are sent. Must match the address in the privacy policy. */
var NOTIFY = "hello@airwarm.co.uk";

/**
 * Handles the form POST.
 *
 * The browser sends Content-Type: text/plain on purpose — see the comment in
 * js/assessment.js. That keeps it a "simple" cross-origin request, so the
 * browser does not send an OPTIONS preflight first. Apps Script cannot answer
 * a preflight, so this is what makes the whole thing work.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: "empty request" });
    }

    var d = JSON.parse(e.postData.contents);

    /* Server-side validation. The browser checks these too, but a request can
       reach this function without ever going through that page. */
    var required = ["name", "address", "postcode", "email", "telephone"];
    for (var i = 0; i < required.length; i++) {
      if (!d[required[i]] || !String(d[required[i]]).trim()) {
        return json({ ok: false, error: "missing " + required[i] });
      }
    }

    /* Consent is not a formality. Without it there is no lawful basis to hold
       any of this, so the enquiry is refused rather than quietly accepted. */
    if (d.consentGiven !== true) {
      return json({ ok: false, error: "consent not given" });
    }

    MailApp.sendEmail({
      to: NOTIFY,
      replyTo: String(d.email).trim(),
      subject: "New Home Assessment Submission - " + clean(d.name) +
               " - " + clean(d.postcode),
      body: buildBody(d)
    });

    return json({ ok: true });
  } catch (err) {
    /* Deliberately vague to the caller: an error message that echoes back
       what was sent would leak it into somewhere it should not be. The page
       tells the visitor to e-mail or call instead, which is a real fallback. */
    return json({ ok: false, error: "could not process" });
  }
}

/**
 * A GET returns a plain health check, so the deployment can be confirmed in a
 * browser without submitting anything. It reveals nothing.
 */
function doGet() {
  return ContentService
    .createTextOutput("Airwarm enquiry endpoint is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/** The e-mail body. Plain text, laid out to be read on a phone. */
function buildBody(d) {
  var L = [];
  L.push("A Home Energy Assessment submission has come in from airwarm.co.uk.");
  L.push("");
  L.push("REFERENCE:  " + clean(d.reference));
  L.push("SUBMITTED:  " + clean(d.submittedAtLocal));
  L.push("TIMESTAMP:  " + clean(d.submittedAt) + " (UTC)");
  L.push("");
  L.push(line());
  L.push("CUSTOMER DETAILS");
  L.push(line());
  L.push("  Name:       " + clean(d.name));
  L.push("  Address:    " + clean(d.address));
  L.push("  House no:   " + clean(d.houseNumber));
  L.push("  Postcode:   " + clean(d.postcode));
  L.push("  E-mail:     " + clean(d.email));
  L.push("  Telephone:  " + clean(d.telephone));
  L.push("  Prefers:    " + prefer(d.preferredContact));
  L.push("");
  L.push(line());
  L.push("PROPERTY (customer's own figures)");
  L.push(line());
  L.push("  Occupants:  " + count(d.property && d.property.occupants));
  L.push("  Rooms:      " + count(d.property && d.property.rooms));
  L.push("  Radiators:  " + count(d.property && d.property.radiators));
  L.push("");
  L.push("  These were asked after the result and are not scored. They are");
  L.push("  the customer's recollection, not a survey: treat them as the");
  L.push("  starting point for the Desktop Review, and expect to correct");
  L.push("  them on site. \"Not stated\" means unknown, not zero and not no.");
  L.push("");
  L.push(line());
  L.push("ASSESSMENT RESULT");
  L.push(line());
  L.push("  " + clean(d.assessmentOutcomeLabel));
  L.push("");
  L.push("  Internal score: " + clean(d.assessmentScore));
  L.push("  Screening score only — reviewed 18 September 2026.");
  L.push("  Use it to prioritise checks, never as a substitute for survey or design.");
  L.push("");

  /* "Why you got this result", as the customer saw it. BLUE only; GREEN
     shows no list and AMBER has no form. Customer-reported, not verified. */
  var why = d.resultReasonsShown;
  if (why && why.length) {
    L.push("  Shown to the customer as \"Why you got this result\":");
    L.push("");
    for (var w = 0; w < why.length; w++) {
      L.push(wrap(clean(why[w]), "  - ", "    "));
    }
    L.push("");
  }

  L.push(line());
  L.push("HOUSEHOLD NEEDS (for planning the work, not scored)");
  L.push(line());
  var h = d.householdNeeds || {};
  L.push("  Extra care needed: " + householdAnswer(h.answer));
  if (h.explicitConsent === true && h.details) {
    L.push(wrap(clean(h.details), "  Details:  ", "            "));
  }
  L.push("  Explicit consent to record: " + (h.explicitConsent === true ? "yes" : "no"));
  L.push("");
  L.push("  May be health information. Record only what is needed to plan");
  L.push("  the work safely, and delete it on request.");
  L.push("");
  L.push(line());
  L.push("QUESTIONNAIRE");
  L.push(line());
  L.push("");

  /* Every question and every answer, in the order they were asked, in the
     wording the customer actually saw. */
  var t = d.transcript;
  if (t && t.length) {
    for (var i = 0; i < t.length; i++) {
      L.push(wrap(clean(t[i].question), "Question: ", "          "));
      L.push(wrap(clean(t[i].answer), "Answer:   ", "          "));
      L.push("");
    }
  } else {
    L.push("(No transcript received. Raw values follow.)");
    L.push("");
    var a = d.answers || {};
    Object.keys(a).forEach(function (k) {
      L.push("Question: " + k);
      L.push("Answer:   " + clean(a[k]));
      L.push("");
    });
  }

  /* What the intake answers mean for the survey.
     The two visual questions — the electrical panel and the radiator
     pipework — are screening signals, not measurements. A photograph shows
     the last visible inch of a pipe and the front of a fuse box; it cannot
     confirm the distribution behind either. These notes carry that limit
     into the review so the answer is not read as a settled figure. */
  var notes = d.surveyNotes;
  if (notes && notes.length) {
    L.push(line());
    L.push("SURVEY NOTES");
    L.push(line());
    L.push("  Screening signals from the intake questions, to be confirmed");
    L.push("  on site. None of these affected the result above.");
    L.push("");
    for (var n = 0; n < notes.length; n++) {
      L.push(wrap(clean(notes[n]), "  - ", "    "));
      L.push("");
    }
  }

  L.push(line());
  L.push("CONSENT");
  L.push(line());
  L.push("  Given at: " + clean(d.consentAt));
  L.push("  For:      holding these details and looking up the public EPC");
  L.push("            record for this address, in order to reply.");
  L.push("");
  L.push(line());
  L.push("NEXT STEP");
  L.push(line());
  L.push("  Look up the EPC for the address, read it against the answers,");
  L.push("  then contact them. Nothing has gone to the customer beyond an");
  L.push("  on-screen acknowledgement quoting the reference above — they are");
  L.push("  expecting a person, not an autoreply.");
  L.push("");
  L.push("  Retention: 12 months from last contact if this does not lead to");
  L.push("  work, per the privacy policy.");

  return L.join("\n");
}

/** A rule, to break the sections up in a plain-text client. */
function line() {
  return "--------------------------------------------------";
}

/**
 * Wraps a long value so it can be read on a phone.
 *
 * Some of the questions are a full sentence long and the survey notes run to
 * three. Left unwrapped they either run off the side of a plain-text client or
 * get rewrapped by it, which loses the "Question: " and "  - " labels down the
 * left and turns the whole e-mail into prose.
 *
 * `firstPrefix` starts the first line — "Question: ", "  - ". `contPrefix`
 * starts every line after it, and should be the same width, so the text stays
 * in one column and the labels stand alone in another.
 */
function wrap(text, firstPrefix, contPrefix) {
  var WIDTH = 78;
  var first = firstPrefix === undefined ? "" : firstPrefix;
  var cont = contPrefix === undefined ? first.replace(/./g, " ") : contPrefix;
  var words = String(text).split(/\s+/);
  var lines = [];
  var current = first;
  var empty = true;

  for (var i = 0; i < words.length; i++) {
    if (!words[i]) { continue; }
    var candidate = empty ? current + words[i] : current + " " + words[i];
    if (!empty && candidate.length > WIDTH) {
      lines.push(current);
      current = cont + words[i];
    } else {
      current = candidate;
    }
    empty = false;
  }
  if (empty) { current = first + "(not given)"; }
  lines.push(current);

  return lines.join("\n");
}

/** The optional preferred-contact value, in words. */
/**
 * A property count for the e-mail: "4", "More than 12", or "Not stated".
 *
 * The form sends the raw select value, so the phrasing is decided here rather
 * than in the browser. "notSure" deliberately reads as "Not stated" — the
 * person reading this needs to know the figure is missing, not that the
 * customer failed a question.
 */
function count(value) {
  /* Checked before clean(), which turns a missing value into "(not given)".
     An older cached copy of the form posts no property block at all, and that
     should read the same as an explicit "Not sure" rather than as a second,
     slightly different kind of missing. */
  if (value === undefined || value === null || value === "") {
    return "Not stated";
  }
  var v = clean(value);
  if (v === "notSure") { return "Not stated"; }
  var more = v.match(/^moreThan(\d+)$/);
  if (more) { return "More than " + more[1]; }
  return v;
}

/** The household-needs answer in words. Older cached forms send nothing. */
function householdAnswer(v) {
  if (v === "yes") { return "yes"; }
  if (v === "no") { return "no"; }
  if (v === "notSure") { return "not sure"; }
  return "not answered";
}

function prefer(v) {
  if (v === "email") { return "e-mail"; }
  if (v === "telephone") { return "telephone"; }
  return "no preference given";
}

/**
 * Strips anything that could turn a value into something other than text.
 * The values arrive from a public form, so they are untrusted input even
 * though they only ever land in a plain-text e-mail.
 */
function clean(v) {
  if (v === undefined || v === null) { return "(not given)"; }
  return String(v).replace(/[\r\n]+/g, " ").trim().slice(0, 500);
}

/** JSON response helper. */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
