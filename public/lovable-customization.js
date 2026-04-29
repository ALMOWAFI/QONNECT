/**
 * Lovable Template Customization Listener
 *
 * Drop-in script for Lovable template apps that enables live theme/font
 * customization from the Lovable template detail page preview.
 *
 * Architecture mirrors SQS's dynamic-templates-preview.js:
 * - Validates message origin (*.lovable.app, *.lovable.dev, localhost)
 * - Validates payload structure
 * - Dispatches to handler: SET_STYLESHEET → inject CSS, SET_FONT_PAIR → load fonts
 * - Notifies parent on beforeunload
 *
 * Message protocol:
 *   { type: "SET_STYLESHEET", payload: { stylesheet: string, fontLinks: [] } }
 *   { type: "SET_FONT_PAIR", payload: { serif: { family, url }, sans: { family, url } } }
 */
(function () {
  "use strict";

  // --- Origin validation (mirrors SQS Ht function) ---
  var VALID_ORIGINS = [
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.lovable\.dev$/,
    /^https:\/\/lovable\.dev$/,
  ];

  function isValidOrigin(origin) {
    if (origin.includes("localhost")) return true;
    return VALID_ORIGINS.some(function (pattern) {
      return pattern.test(origin);
    });
  }

  // --- Payload validation (mirrors SQS Vt function) ---
  function isStylesheetMessage(data) {
    return (
      data &&
      data.type === "SET_STYLESHEET" &&
      data.payload &&
      typeof data.payload.stylesheet === "string"
    );
  }

  function isFontPairMessage(data) {
    return (
      data &&
      data.type === "SET_FONT_PAIR" &&
      data.payload &&
      data.payload.serif &&
      data.payload.sans
    );
  }

  function isValidPayload(data) {
    return isStylesheetMessage(data) || isFontPairMessage(data);
  }

  // --- Style element management ---
  var STYLE_ID = "lovable-theme-override";
  var FONT_STYLE_ID = "lovable-font-override";

  function getOrCreateStyleElement(id) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    return el;
  }

  // --- Handlers (mirrors SQS St/xt/pt functions) ---

  function handleSetStylesheet(payload) {
    var styleEl = getOrCreateStyleElement(STYLE_ID);
    styleEl.textContent = payload.stylesheet;
  }

  function handleSetFontPair(payload) {
    var serif = payload.serif;
    var sans = payload.sans;

    // Load font CSS via <link> tags
    loadFontLink("lovable-font-serif", serif.url);
    loadFontLink("lovable-font-sans", sans.url);

    // Apply font families via CSS custom properties + direct overrides
    var css =
      ":root {\n" +
      '  --font-serif: "' + serif.family + '", serif;\n' +
      '  --font-sans: "' + sans.family + '", sans-serif;\n' +
      "}\n" +
      "body {\n" +
      '  font-family: "' + sans.family + '", sans-serif !important;\n' +
      "}\n" +
      "h1, h2, h3, h4, h5, h6 {\n" +
      '  font-family: "' + serif.family + '", serif !important;\n' +
      "}\n" +
      "button, nav, .heading, .sans-serif {\n" +
      '  font-family: "' + sans.family + '", sans-serif !important;\n' +
      "}";

    var styleEl = getOrCreateStyleElement(FONT_STYLE_ID);
    styleEl.textContent = css;
  }

  function loadFontLink(id, url) {
    var existing = document.getElementById(id);
    if (existing) existing.remove();

    var link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  // --- Notify parent (mirrors SQS R function) ---
  function notifyParent(data) {
    try {
      var origin;
      if (
        document.location.ancestorOrigins &&
        document.location.ancestorOrigins[0]
      ) {
        origin = document.location.ancestorOrigins[0];
      } else if (document.referrer) {
        origin = new URL(document.referrer).origin;
      } else {
        return;
      }
      window.parent.postMessage(JSON.stringify(data), origin);
    } catch (e) {
      // silently ignore
    }
  }

  // --- Main listener (mirrors SQS window.addEventListener("message", ...)) ---
  window.addEventListener("message", function (event) {
    if (!event.origin || !isValidOrigin(event.origin)) {
      return;
    }
    if (!isValidPayload(event.data)) {
      return;
    }

    if (isStylesheetMessage(event.data)) {
      handleSetStylesheet(event.data.payload);
    } else if (isFontPairMessage(event.data)) {
      handleSetFontPair(event.data.payload);
    }
  });

  // --- Notify parent on navigation (mirrors SQS beforeunload handler) ---
  window.addEventListener("beforeunload", function () {
    notifyParent({ beforeunload: document.location.href });
  });

  // --- Signal ready to parent ---
  notifyParent({ type: "lovable:ready" });
})();
