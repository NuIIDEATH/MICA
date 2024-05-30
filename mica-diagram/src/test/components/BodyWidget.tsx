import * as React from 'react';
import _keys from 'lodash/keys';
import { TrayWidget } from './TrayWidget';
import { Application } from '../Application';
import { TrayItemWidget } from './TrayItemWidget';
import {
  DefaultNodeModel,
  DefaultPortModel,
  RightAngleLinkModel,
  LinkModel,
  DefaultLinkModel,
} from '@projectstorm/react-diagrams';
import {
  AbstractModelFactory,
  CanvasWidget,
  BaseModel,
} from '@projectstorm/react-canvas-core';
import { DemoCanvasWidget } from './DemoCanvasWidget';
import { DemoWorkspaceWidget, DemoButton } from './DemoWorkspaceWidget';
import styled from '@emotion/styled';

export interface BodyWidgetProps {
  app: Application;
}

namespace S {
  export const Body = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  `;

  export const Header = styled.div`
    display: flex;
    background: rgb(30, 30, 30);
    flex-grow: 0;
    flex-shrink: 0;
    color: white;
    font-family: Helvetica, Arial, sans-serif;
    padding: 10px;
    align-items: center;
  `;

  export const Input = styled.div`
    background: rgb(30, 30, 30);
    display: flex; // 使用Flexbox布局
    align-items: center; // 垂直居中对齐子元素
    width: 100%; // 占满父元素宽度
  `;

  export const StyledInput = styled.input`
    flex: 1; // 输入框占据剩余空间
    background-color: #202020; // 设置灰色背景
    color: #ffffff; // 设置文本颜色为黑色，以便在灰色背景上清晰可见
    border: none; /* 移除了边框 */
    &:focus {
      outline: none; /* 移除聚焦时的默认轮廓 */
      border-bottom: 2px solid #333; /* 聚焦时添加下边框 */
    }
    font-size: 16px; // 字体大小
  `;

  export const StyledButton = styled.button`
    padding: 10px 20px; // 内边距
    border: none; // 无边框
    background-color: #007bff; // 背景颜色
    color: white; // 文字颜色
    font-size: 16px; // 字体大小
    cursor: pointer; // 鼠标悬停时显示指针手势
    transition: background-color 0.3s; // 背景颜色变化的过渡效果

    &:hover {
      background-color: #0056b3; // 鼠标悬停时的背景颜色
    }
  `;

  export const Content = styled.div`
    display: flex;
    flex-grow: 1;
  `;

  export const Layer = styled.div`
    position: relative;
    flex-grow: 1;
  `;
}

interface Item {
  type: string;
  name: string;
  color: string;
}

interface moduleInfo {
  name: string;
  param: [];
  input: string[];
  output: string[];
}

interface connectInfo {
  srcmodule: string;
  dstmodule: string;
  srcport: string[];
  dstport: string[];
}

export const CustomTrayWidget = ({ items }: { items: Item[] }) => {
  return (
    <div>
      {items.map((item) => (
        <TrayItemWidget
          key={item.type}
          model={item}
          name={item.name}
          color={item.color}
        />
      ))}
    </div>
  );
};

export class RightAnglePortModel extends DefaultPortModel {
  createLinkModel(factory?: AbstractModelFactory<LinkModel>) {
    return new RightAngleLinkModel();
  }
}

export class BodyWidget extends React.Component<BodyWidgetProps> {
  state = {
    userInput: '', // 用于存储输入框的内容
    response: null, // 用于存储后端返回的响应
    message: null,
    modulesInfo: [] as moduleInfo[],
    trayItems: [],
    connectInfo: [] as connectInfo[],
  };

  handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ userInput: event.target.value });
  };

  handleButtonClick = async () => {
    const input = this.state.userInput;
    try {
      // 使用fetch发送请求到后端
      const response = await fetch('http://localhost:5000/process_file', {
        method: 'POST', // 或者'GET'，根据你的后端API设计
        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({ input: input }), // 发送输入框的内容
      });

      if (!response.ok) {
        // 如果响应状态码不是2xx，抛出错误
        throw new Error(`HTTP error! Check Flask! status: ${response.status}`);
      }
      const data = await response.json(); // 解析JSON响应
      this.setState({ response: data }); // 更新状态以存储响应
      this.setState({ message: data.message });
      this.setState({ trayItems: data.items });
      this.setState({ modulesInfo: data.modules_info });
    } catch (error) {
      console.error('请求失败:', error);
    }
  };

  ConnectAutoEntities = async () => {
    const selectedEntities = this.props.app
      .getActiveDiagram()
      .getSelectedEntities();
    const selectedNodes = selectedEntities.filter(
      (entity) => entity instanceof DefaultNodeModel,
    );

    // 序列化选中的节点
    const serializedNodes = selectedNodes.map((node) => node.serialize());
    const jsonString = JSON.stringify(serializedNodes);
    try {
      // 发送序列化数据到后端
      const response = await fetch('http://localhost:5000/process_connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonString,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Success:', data);
      this.setState({ message: data.message });
    } catch (error) {
      console.error('Error sending serialized nodes:', error);
    }
  };

  checkSelectedEntities = () => {
    const selectedEntities = this.props.app
      .getActiveDiagram()
      .getSelectedEntities();
    // 遍历所有选中的实体
    selectedEntities.forEach((entity) => {
      if (entity instanceof LinkModel) {
        (entity as DefaultLinkModel).addLabel('Edited');
      }
    });
    this.props.app.getDiagramEngine().repaintCanvas();
  };

  handleMarkButtonClick = () => {
    this.checkSelectedEntities();
  };

  handleConnectButtonClick = () => {
    this.ConnectAutoEntities();
  };

  render() {
    return (
      <S.Body>
        <S.Header>
          <div className="title">MICA - Moudle Instantiate & Connect Auto</div>
        </S.Header>
        <S.Input>
          <S.StyledInput
            type="text"
            value={this.state.userInput}
            onChange={this.handleInputChange}
            placeholder="Input filelist to parser" /* 直接在JSX中添加placeholder属性 */
            style={{ flex: 1, margin: '0 10px 0 0', height: '20px' }} //
          />
          <S.StyledButton onClick={this.handleButtonClick}>
            Sendout
          </S.StyledButton>
          {/* 根据需要显示后端响应 */}
          {this.state.message && (
            <div style={{ color: '#fff' }}>{this.state.message}</div>
          )}
        </S.Input>
        <S.Content>
          <TrayWidget>
            <TrayItemWidget
              model={{ type: 'in' }}
              name="Unused Output"
              color="rgb(192,255,0)"
            />
            <TrayItemWidget
              model={{ type: 'out' }}
              name="Constant Input"
              color="rgb(0,192,255)"
            />
            <CustomTrayWidget items={this.state.trayItems} />{' '}
            {/* 使用明确的Item[]类型 */}
          </TrayWidget>
          <S.Layer
            onDrop={(event) => {
              var data = JSON.parse(
                event.dataTransfer.getData('storm-diagram-node'),
              );
              var nodesCount = _keys(
                this.props.app.getDiagramEngine().getModel().getNodes(),
              ).length;

              var node: DefaultNodeModel | null = null;
              if (data.type === 'in') {
                node = new DefaultNodeModel(
                  'Unused Output ' + (nodesCount + 1),
                  'rgb(192,255,0)',
                );
                node.addPort(new RightAnglePortModel(true, 'In', 'Unused'));
              } else if (data.type === 'out') {
                node = new DefaultNodeModel(
                  'Constant Input ' + (nodesCount + 1),
                  'rgb(0,192,255)',
                );
                node.addPort(new RightAnglePortModel(false, 'Out', 'Constant'));
              } else {
                const module_instname =
                  data.type +
                  ' --- u_inst' +
                  (nodesCount + 1) +
                  '_' +
                  data.type;
                node = new DefaultNodeModel(module_instname, 'rgb(192,0,255)');
                const itemWithName = this.state.modulesInfo.find(
                  (item) => item.name === data.type,
                );
                console.error(itemWithName);
                if (itemWithName) {
                  for (const item of itemWithName.input) {
                    node.addPort(
                      new RightAnglePortModel(
                        true,
                        module_instname + item,
                        item,
                      ),
                    );
                  }
                  for (const item of itemWithName.output) {
                    node.addPort(
                      new RightAnglePortModel(
                        false,
                        module_instname + item,
                        item,
                      ),
                    );
                  }
                } else {
                  // 处理未找到匹配项的情况
                  console.error('Module with type', data.type, 'not found.');
                }
              }
              var point = this.props.app
                .getDiagramEngine()
                .getRelativeMousePoint(event);
              node.setPosition(point);
              this.props.app.getDiagramEngine().getModel().addNode(node);
              this.forceUpdate();
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
          >
            <DemoWorkspaceWidget
              buttons={[
                <DemoButton
                  onClick={() => this.props.app.getDiagramEngine().zoomToFit()}
                >
                  Zoom to fit
                </DemoButton>,
                <DemoButton onClick={() => this.handleMarkButtonClick()}>
                  Link Add Edit Label
                </DemoButton>,
                <DemoButton onClick={() => this.handleConnectButtonClick()}>
                  Connect AUTO
                </DemoButton>,
              ]}
            >
              <DemoCanvasWidget>
                <CanvasWidget engine={this.props.app.getDiagramEngine()} />
              </DemoCanvasWidget>
            </DemoWorkspaceWidget>
          </S.Layer>
        </S.Content>
      </S.Body>
    );
  }
}
