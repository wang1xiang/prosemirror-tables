# prosemirror 源码解读

## 名次解释

### [Decorations](https://www.xheldon.com/tech/prosemirror-guide-chinese.html?mode=light#decorations)

用于绘制`document view`，通过`decorations`属性的返回值来创建，包含三种类型

- Node decorations: 增加样式或其他 `DOM` 属性到单个 node 的 `DOM` 上，如选中表格时增加的类名
- Widget decorations: 在给定位置插入 `DOM node`，并不是实际文档的一部分，如表格拖拽时增加的基线
- Inline decoration: 在给定的 `range` 中的行内杨素插入样式或属性，类似于 `Node decorations`，仅针对行内元素

`prosemirror` 为了快速绘制这些类型，通过 `decorationSet.create` 静态方法来创建

```js
import { Plugin, PluginKey } from 'prosemirror-state';
let purplePlugin = new Plugin({
  props: {
    decorations(state) {
      return DecorationSet.create(state.doc, [
        Decoration.inline(0, state.doc.content.size, {
          style: 'color: purple',
        }),
      ]);
    },
  },
});
```

### [Selection](https://prosemirror.net/docs/ref/#state.Selection)

`prosemirror`中默认定义两种类型的选区对象：

- TextSelection：文本选区，同时也可以表示正常的光标（即未选择任何文本时，此时`anchor = head`），包含`$anchor`选区固定的一侧，通常是左侧，`$head`选区移动的一侧，通常是右侧
- NodeSelection: 节点选区，表示一个节点被选择

也可以通过继承`Selection`父类来实现自定义的选区类型，如`CellSelection`

## 源码目录

.
├── README.md 项目说明文档
├── cellselection.ts 定义 cellSelection 选择子类
├── columnresizing.ts 实现列拖拽
├── commands.ts
├── copypaste.ts
├── fixtables.ts
├── index.html
├── index.ts
├── input.ts
├── schema.ts
├── tablemap.ts
├── tableview.ts
└── util.ts

### cellselection.ts

定义`CellSelection`选区对象，继承自`Selection`

**重要方法**

- drawCellSelection：用于当跨单元格选择时，绘制选区，会添加到`tableEditing`的`decorations`为每个选中节点增加`class`类`selectedCell` ，`tableEditing`最后会注册为`Editor`的插件使用

### columnresizing.ts

定义`columnResizing`插件，用于实现列拖拽功能，大致思路如下：

在鼠标移动到列上时，通过`Decoration.widget`来绘制所需要的`DOM`，

- $cell.start(-1) 获取给定级别节点到起点的（绝对）位置。
- TableMap.get(table) 获取当前表格数据，包含 width 列数、height 行数、map 行 pos\*列 pos 形成的数组

解析文档中的给定位置，返回一个带有上下文信息的对象。
const $cell = state.doc.resolve(cell);
给定级别的祖先节点。p.node（p.depth）与p.parent相同。
const table = $cell.node(-1);
给定级别节点起点的（绝对）位置。
$cell.start(-1);
