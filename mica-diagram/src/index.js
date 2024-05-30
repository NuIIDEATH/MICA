import React from "react";
import ReactDOM from "react-dom";
import './styles.css'; // 导入全局CSS文件

import App from "./App";

const rootElement = document.getElementById("root");
ReactDOM.render(
<React.StrictMode>
<App />
</React.StrictMode>,
rootElement
);
