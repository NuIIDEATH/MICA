import * as SRD from '@projectstorm/react-diagrams';
import { RightAngleLinkFactory } from '@projectstorm/react-diagrams';

/**
 * @author Dylan Vorster
 */

export class Application {
  protected activeModel: SRD.DiagramModel;
  protected diagramEngine: SRD.DiagramEngine;

  constructor() {
    this.activeModel = new SRD.DiagramModel(); // 或者任何合适的初始值
    this.diagramEngine = SRD.default();
    this.diagramEngine
      .getLinkFactories()
      .registerFactory(new RightAngleLinkFactory());
    this.newModel();
  }

  public newModel() {
    this.activeModel = new SRD.DiagramModel();
    this.activeModel.setGridSize(50);
    this.diagramEngine.setModel(this.activeModel);
  }

  public getActiveDiagram(): SRD.DiagramModel {
    return this.activeModel;
  }

  public getDiagramEngine(): SRD.DiagramEngine {
    return this.diagramEngine;
  }
}
