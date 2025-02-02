import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { initStore } from "./store";
import { showFullReport, showPartialReport, showNoReport } from "./reportSlice";
import { changeTheme, ThemeState } from "@xliic/web-theme";
import { KdbState } from "./kdbSlice";
import { HostApplication } from "./types";

import App from "./components/App";

import "./bootstrap.min.css";
import "./style.css";

function renderAuditReport(host: HostApplication, kdb: KdbState, theme: ThemeState) {
  const store = initStore(host, kdb, theme);
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "showFullReport":
        window.scrollTo(0, 0);
        store.dispatch(showFullReport(message.report));
        break;
      case "showPartialReport":
        window.scrollTo(0, 0);
        store.dispatch(
          showPartialReport({ report: message.report, ids: message.ids, uri: message.uri })
        );
        break;
      case "showNoReport":
        window.scrollTo(0, 0);
        store.dispatch(showNoReport());
        break;
      case "changeTheme":
        store.dispatch(changeTheme(message.payload));
        break;
    }
  });
}

(window as any).renderAuditReport = renderAuditReport;
