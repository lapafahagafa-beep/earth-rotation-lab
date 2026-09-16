# 地球自转与昼夜交替交互实验室

一个用于演示地球自转、昼夜交替、太阳直射点与主要纬线的交互式教学网页。

## 在线体验

https://earth-rotation-lab.lapafahagafa.chatgpt.site/

## 本地运行

```bash
pnpm install
pnpm dev
```

## 教学控制

- **地球视角 / 太阳中心视角**：共用节气时间、自转和极圈开关。太阳中心视角展示公转轨道、倾斜地轴、主要纬线和直射光线。
- **一键定格节气**：春分、夏至、秋分、冬至会同时暂停公转与自转；点击“恢复自转”或“播放公转”可分别继续。
- **晨线 / 昏线**：青色为夜→昼，粉色为昼→夜；箭头沿当地自西向东自转方向。标签根据三维太阳方向计算，背面的标签隐藏，可拖动查看。
- **南北极圈**：66.5°N / 66.5°S，绿色虚线，可在控制面板隐藏。
- 播放速度控制同时作用于正在播放的自转和公转，二者可独立暂停。

模型假设和测试结果见 [VALIDATION.md](VALIDATION.md)。

## 发布

GitHub 保存源代码。在线地址由 Sites 管理；GitHub 提交不会自动触发 Sites 发布。需要将相同源代码推送至该 Site 的源代码仓库，构建后保存版本并发布。

## 太阳纹理

`public/sun-surface.jpg` 来自 [Solar System Scope](https://www.solarsystemscope.com/textures/) 的 2K Sun 球面纹理，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 使用。渲染中进行了颜色混合和临边昏暗处理，并增加示意光晕；不是实时太阳观测影像。太阳显示半径 1.5、地球显示半径 1、公转轨道半径 5，是为课堂观察保留地球细节的示意比例。真实直径比约 109，参见 [NASA](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html)。
