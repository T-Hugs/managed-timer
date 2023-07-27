import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";

import App from "./app/app";

const root = ReactDOM.createRoot(
	document.getElementById("root") as HTMLElement
);
root.render(
	<div>
		<App />
		<template className="sentinel bg-gunmetal text-white bg-flame bg-air bg-olivine" />
	</div>
);
