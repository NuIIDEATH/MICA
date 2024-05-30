import React from 'react';
// import { FlowChartApp } from './utils/FlowChartApp';
// import { FlowChart } from './components/FlowChart';
import { BodyWidget } from './test/components/BodyWidget';
import { Application } from './test/Application';
import './styles.css';

export default function App() {
var app = new Application();
return (
<div className="App">
<BodyWidget app={app} />
</div>
);
}
