# ProseMirror table 模块

该模块定义了一个模式扩展来支持具有 `rowspan/colspan` 支持的表，
一个用于在此类表中进行单元格选择的自定义选择类，一个用于管理此类
选择并在此类表上强制执行不变量的插件，以及一些用于处理表的命令。

顶层目录包含一个 `demo.js` 和 `index.html`，可以使用
`yarn build_demo` 构建，以显示如何使用该模块的简单演示。

## [演示DEMO](https://prosemirror-tables.netlify.app/)

## 文档

该模块的主文件导出了您需要使用它的所有内容。 您可能想要做的第一件事
是创建一个支持表的模式。 这就是 `tableNodes` 的用途：

* **`tableNodes`**`(options: Object) → Object`\
   此函数为该模块使用的 `table`、`table_row` 和 `table_cell` 节点类型创建一组[节点规范](https://prosemirror.net/docs/ref/#model.SchemaSpec.nodes)。 然后可以在创建模式时将结果添加到节点集。

  * **`options`**`: Object`\
      理解以下选项：

    * **`tableGroup`**`: ?string`\
         添加到表节点类型的组名（类似于"block"）。

    * **`cellContent`**`: string`\
         表格单元格的内容表达式。

    * **`cellAttributes`**`: ?Object`\
         要添加到单元格的附加属性。 将属性名称映射到
          具有以下属性的对象：

      * **`default`**`: any`\
            属性的默认值。

      * **`getFromDOM`**`: ?fn(dom.Node) → any`\
            从 DOM 节点读取属性值的函数。

      * **`setDOMAttr`**`: ?fn(value: any, attrs: Object)`\
            将属性的值添加到属性的函数，用于呈现单元格 DOM 的对象。

* **`tableEditing`**`() → Plugin`\
   创建一个[插件](http://prosemirror.net/docs/ref/#state.Plugin)，当添加到编辑器
   时，启用单元格选择，处理基于单元格的复制/粘贴，并确保表格保持格式正确（每行具有相同的宽度，单元格不重叠）。

   你可能应该把这个插件放在你的插件数组的末尾附近，因为它处理表格中的
   鼠标和箭头键事件相当广泛，而其他插件，比如间隙光标或列宽拖动插件，
   可能希望先轮流执行更具体的行为。

### class CellSelection extends Selection

一个 [`Selection`](http://prosemirror.net/docs/ref/#state.Selection) 子类，表示跨表格部分的单元格选择。启用插件后，这些将在用户跨单元格进行选择时创建，并通过为所选单元格提供 `selectedCell` CSS 类来绘制。

* `new`**`CellSelection`**`($anchorCell: ResolvedPos, $headCell: ?ResolvedPos = $anchorCell)`\
   表格选择由其锚点和标题单元格标识。赋予此构造函数的位置应指向同一个表中的两个单元格之前。它们可能相同，选择单个单元格。

* **`$anchorCell`**`: ResolvedPos`\
   指向锚单元格前面的解析位置（扩展选择时不会移动的位置）。

* **`$headCell`**`: ResolvedPos`\
   指向头部单元格前面的解析位置（扩展选择时移动的位置）。

* **`content`**`() → Slice`\
   返回包含所选单元格的表格行的矩形切片。

* **`isColSelection`**`() → bool`\
   如果此选择从表格的顶部一直延伸到底部，则为真。

* **`isRowSelection`**`() → bool`\
   如果此选择从表格的左侧一直延伸到右侧，则为真。

* `static`**`colSelection`**`($anchorCell: ResolvedPos, $headCell: ?ResolvedPos = $anchorCell) → CellSelection`\
   返回覆盖给定锚点和头单元格的最小列选择。

* `static`**`rowSelection`**`($anchorCell: ResolvedPos, $headCell: ?ResolvedPos = $anchorCell) → CellSelection`\
   返回覆盖给定锚点和头单元格的最小行选择。

* `static`**`create`**`(doc: Node, anchorCell: number, headCell: ?number = anchorCell) → CellSelection`

### Commands

以下命令可用于使用户可以使用表格编辑功能。

* **`addColumnBefore`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   在带有选择的列之前添加一列。

* **`addColumnAfter`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   在带有选择的列之后添加一列。

* **`deleteColumn`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
    从表中删除选定的列。

* **`addRowBefore`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   在带有选择的行之前添加表格行。

* **`addRowAfter`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   在带有选择的行之后添加表格行。

* **`deleteRow`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   从表中删除选定的行。

* **`mergeCells`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   将选定的单元格合并为一个单元格。仅当所选单元格的轮廓形成矩形时可用。

* **`splitCell`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   将 rowpan 或 colspan 大于 1 的选定单元格拆分为更小的单元格。对新单元格使用第一种单元格类型。

* **`splitCellWithType`**`(getType: fn({row: number, col: number, node: Node}) → NodeType) → fn(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   将 rowpan 或 colspan 大于 1 的选定单元格拆分为 getType 函数返回的单元格类型 (th, td) 的较小单元格。

* **`setCellAttr`**`(name: string, value: any) → fn(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   返回将给定属性设置为给定值的命令，并且仅在当前选定的单元格尚未将该属性设置为该值时才可用。

* **`toggleHeaderRow`**`(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   切换所选行为标题单元格。

* **`toggleHeaderColumn`**`(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   Toggles whether the selected column contains header cells.

* **`toggleHeaderCell`**`(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   切换所选单元格为标题单元格。

* **`toggleHeader`**`(type: string, options: ?{useDeprecatedLogic: bool}) → fn(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   在行/列标题和普通单元格之间切换（仅适用于第一行/列）。对于弃用的
   行为，在选项中使用 `useDeprecatedLogic` 并设置为 true。

* **`goToNextCell`**`(direction: number) → fn(EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   返回用于选择表中下一个（方向=1）或上一个（方向=-1）单元格的命令。

* **`deleteTable`**`(state: EditorState, dispatch: ?fn(tr: Transaction)) → bool`\
   删除所选内容周围的表格（如果有）。

### Utilities

* **`fixTables`**`(state: EditorState, oldState: ?EditorState) → ?Transaction`\
   检查给定状态文档中的所有表，并在必要时返回修复它们的事务。如果提供
   了 `oldState` ，则假定它保持先前的已知良好状态，这将用于避免重新
   扫描文档的未更改部分。

### class TableMap

表映射描述给定表的结构。为了避免一直重新计算它们，它们按表节点进行缓存。
为了能够做到这一点，保存在地图中的位置是相对于表格的开始，而不是文档的开始。

* **`width`**`: number`\
   表格宽度

* **`height`**`: number`\
   表格高度

* **`map`**`: [number]`\
   width * height数组，其中单元格的起始位置覆盖每个槽中表格的那部分

* **`findCell`**`(pos: number) → Rect`\
   找到给定位置的单元格的尺寸。

* **`colCount`**`(pos: number) → number`\
   在给定位置找到单元格的左侧。

* **`nextCell`**`(pos: number, axis: string, dir: number) → ?number`\
   从 `pos` 处的单元格开始，在给定方向上查找下一个单元格（如果有）。

* **`rectBetween`**`(a: number, b: number) → Rect`\
   获取跨越两个给定单元格的矩形。

* **`cellsInRect`**`(rect: Rect) → [number]`\
   返回给定矩形中具有左上角的所有单元格的位置。

* **`positionAt`**`(row: number, col: number, table: Node) → number`\
   返回给定行和列的单元格开始或将开始的位置，如果单元格从那里开始。

* `static`**`get`**`(table: Node) → TableMap`\
   查找给定表节点的表映射。
