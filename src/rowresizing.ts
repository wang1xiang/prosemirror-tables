import { Attrs, Node as ProsemirrorNode } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  NodeView,
} from 'prosemirror-view';
import { columnResizingPluginKey } from './columnresizing';
import { tableNodeTypes } from './schema';
import { TableMap } from './tablemap';
import { TableView } from './tableview';
import { cellAround, CellAttrs, pointsAtCell } from './util';

/**
 * @public
 */
export const rowResizingPluginKey = new PluginKey<ResizeState>(
  'tableRowResizing',
);

/**
 * @public
 */
export type RowResizingOptions = {
  handleHeight?: number;
  View?: new (
    node: ProsemirrorNode,
    view: EditorView,
  ) => NodeView;
};

/**
 * @public
 */
export type Dragging = { startY: number; startHeight: number };

/**
 * @public
 */
export function rowResizing({
  handleHeight = 10,
  // @ts-expect-error: Unreachable code error
  View = TableView,
}: RowResizingOptions = {}): Plugin {
  const plugin = new Plugin<ResizeState>({
    key: rowResizingPluginKey,
    state: {
      init(_, state) {
        plugin.spec!.props!.nodeViews![
          tableNodeTypes(state.schema).table.name
        ] = (node, view) => new View(node, view);
        return new ResizeState(-1, false);
      },
      apply(tr, prev) {
        return prev.apply(tr);
      },
    },
    props: {
      attributes: (state): Record<string, string> => {
        const pluginState = rowResizingPluginKey.getState(state);
        const columnState = columnResizingPluginKey.getState(state);
        return pluginState && pluginState.activeHandle > -1 && columnState?.activeHandle === -1
          ? { class: 'resize-cursor-row' }
          : {};
      },

      handleDOMEvents: {
        mousemove: (view, event) => {
          handleMouseMove(
            view,
            event,
            handleHeight,
          );
        },
        mouseleave: (view) => {
          handleMouseLeave(view);
        },
        mousedown: (view, event) => {
          handleMouseDown(view, event);
        },
      },

      decorations: (state) => {
        const pluginState = rowResizingPluginKey.getState(state);
        // 优先渲染列拖债
        const columnState = columnResizingPluginKey.getState(state);
        if (pluginState && pluginState.activeHandle > -1 && columnState?.activeHandle === -1) {
          return handleDecorations(state, pluginState.activeHandle);
        }
      },

      nodeViews: {},
    },
  });
  return plugin;
}

/**
 * @public
 */
export class ResizeState {
  constructor(public activeHandle: number, public dragging: Dragging | false) {}

  apply(tr: Transaction): ResizeState {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const state = this;
    const action = tr.getMeta(rowResizingPluginKey);
    if (action && action.setHandle != null)
      return new ResizeState(action.setHandle, false);
    if (action && action.setDragging !== undefined)
      return new ResizeState(state.activeHandle, action.setDragging);
    if (state.activeHandle > -1 && tr.docChanged) {
      let handle = tr.mapping.map(state.activeHandle, -1);
      if (!pointsAtCell(tr.doc.resolve(handle))) {
        handle = -1;
      }
      return new ResizeState(handle, state.dragging);
    }
    return state;
  }
}

function handleMouseMove(
  view: EditorView,
  event: MouseEvent,
  handleHeight: number,
): void {
  const pluginState = rowResizingPluginKey.getState(view.state);
  if (!pluginState) return;

  if (!pluginState.dragging) {
    // 找到目标td
    const target = domCellAround(event.target as HTMLElement);
    let cell = -1;
    if (target) {
      // 这里会导致最下面一行没有出现拖拽
      const { top, bottom } = target.getBoundingClientRect();
      if (event.clientY - top <= handleHeight)
        cell = edgeCell(view, event, 'top', handleHeight);
      if (bottom - event.clientY <= handleHeight)
        cell = edgeCell(view, event, 'bottom', handleHeight);
    }

    if (cell != pluginState.activeHandle) {
      updateHandle(view, cell);
    }
  }
}

function handleMouseLeave(view: EditorView): void {
  const pluginState = rowResizingPluginKey.getState(view.state);
  if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging)
    updateHandle(view, -1);
}

function handleMouseDown(
  view: EditorView,
  event: MouseEvent,
): boolean {
  const pluginState = rowResizingPluginKey.getState(view.state);
  if (!pluginState || pluginState.activeHandle == -1 || pluginState.dragging)
    return false;

  const cell = view.state.doc.nodeAt(pluginState.activeHandle)!;
  const height = currentRowHeight(view, pluginState.activeHandle, cell.attrs);
  view.dispatch(
    view.state.tr.setMeta(rowResizingPluginKey, {
      setDragging: { startY: event.clientY, startHeight: height },
    }),
  );

  const clientHeight = (event.target as HTMLElement)!.getBoundingClientRect().height;

  console.log(clientHeight);
  function finish(event: MouseEvent) {
    window.removeEventListener('mouseup', finish);
    window.removeEventListener('mousemove', move);
    const pluginState = rowResizingPluginKey.getState(view.state);
    if (pluginState?.dragging) {
      updateRowHeight(
        view,
        pluginState.activeHandle,
        draggedHeight(pluginState.dragging, event),
      );
      view.dispatch(
        view.state.tr.setMeta(rowResizingPluginKey, { setDragging: null }),
      );
    }
  }

  function move(event: MouseEvent): void {
    if (!event.which) return finish(event)
    const pluginState = rowResizingPluginKey.getState(view.state);
    if (!pluginState) return;
    if (pluginState.dragging) {
      // 拖动距离
      const dragHeight = draggedHeight(pluginState.dragging, event);
      // updateRowHeight(
      //   view,
      //   pluginState.activeHandle,
      //   0
      // );
      const placeHolderDom = document.querySelectorAll('.placeholder-dom');
      placeHolderDom.forEach((dom) => {
        (dom as HTMLElement).style.height = dragHeight - clientHeight + 'px';
      })
    }
  }

  window.addEventListener('mouseup', finish);
  window.addEventListener('mousemove', move);
  event.preventDefault();
  return true;
}

function currentRowHeight(
  view: EditorView,
  cellPos: number,
  { rowHeight }: Attrs,
): number {
  const width = rowHeight;
  if (width) return width;
  const dom = view.domAtPos(cellPos);
  const domHeight = (dom.node as HTMLElement).offsetHeight;
  return domHeight;
}

function domCellAround(target: HTMLElement | null): HTMLElement | null {
  while (target && target.nodeName != 'TD' && target.nodeName != 'TH')
    target =
      target.classList && target.classList.contains('ProseMirror')
        ? null
        : (target.parentNode as HTMLElement);
  return target;
}

function edgeCell(
  view: EditorView,
  event: MouseEvent,
  side: 'top' | 'bottom',
  handleHeight: number,
): number {
  // posAtCoords returns inconsistent positions when cursor is moving
  // across a collapsed table border. Use an offset to adjust the
  // target viewport coordinates away from the table border.
  const offset = side == 'bottom' ? -handleHeight : handleHeight;
  const found = view.posAtCoords({
    left: event.clientX,
    top: event.clientY + offset,
  });
  if (!found) return -1;
  const { pos } = found;
  const $cell = cellAround(view.state.doc.resolve(pos));
  if (!$cell) return -1;
  if (side == 'bottom') return $cell.pos;
  const map = TableMap.get($cell.node(-1)),
    start = $cell.start(-1);
  // 找到此列在表格中的index
  const index = map.map.indexOf($cell.pos - start);
  // 如果是在此列的左侧 则调整的是前一列 次行代码获取前一列
  return index % map.width == 0 ? -1 : start + map.map[index - map.width];
}

function draggedHeight(
  dragging: Dragging,
  event: MouseEvent,
): number {
  const offset = event.clientY - dragging.startY;
  let dragHeight = dragging.startHeight + offset;
  if (dragHeight < 0) dragHeight = 38;
  return dragHeight;
}

function updateHandle(view: EditorView, value: number): void {
  view.dispatch(
    view.state.tr.setMeta(rowResizingPluginKey, { setHandle: value }),
  );
}

function updateRowHeight(
  view: EditorView,
  cell: number,
  height: number,
): void {
  const $cell = view.state.doc.resolve(cell);
  const table = $cell.node(-1),
    map = TableMap.get(table),
    start = $cell.start(-1);
  const tr = view.state.tr;
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan;
  let index = map.map.findIndex((item) => item === $cell.pos - start);
  // @ts-expect-error: Unreachable code error
  const lastIndex = map.map.findLastIndex(item => item === $cell.pos - start);
  if (index !== lastIndex) {
    index = Math.min(index + col - 1, lastIndex);
  }
  for (let row = 0; row < map.width; row++) {
    // Rowspanning cell that has already been handled
    let cellPos = map.map[index];
    if (row !== col - 1) {
      const extraIndex = index - (col - 1) + row;
      cellPos = map.map[extraIndex];
      // 如果出现合并行的问题 需要处理一下不让出现拖拽的线条
      if (cellPos === map.map[extraIndex + map.width]) {
        continue;
      }
    }
    const attrs = table.nodeAt(cellPos)!.attrs as CellAttrs;
    tr.setNodeMarkup(start + cellPos, null, { ...attrs, height: height });
  }
  if (tr.docChanged) view.dispatch(tr);
}

// 用于创建拖拽的DOM
export function handleDecorations(
  state: EditorState,
  cell: number,
): DecorationSet {
  const decorations = [];

  // 解析文档中的给定位置，返回一个带有上下文信息的对象。
  const $cell = state.doc.resolve(cell);
  // 给定级别的祖先节点。p.node（p.depth）与p.parent相同。
  const table = $cell.node(-1);
  if (!table) {
    return DecorationSet.empty;
  }

  // 返回width * height数组
  const map = TableMap.get(table);
  // 给定级别节点起点的（绝对）位置。
  const start = $cell.start(-1);

  // map.colCount 在给定位置找到单元格的左侧。
  // $cell.nodeAfter如果有的话，直接获取位置之后的节点。如果位置指向一个文本节点，只返回该节点在位置之后的部分。
  const col = map.colCount($cell.pos - start) + $cell.nodeAfter!.attrs.colspan;
  let index = map.map.findIndex((item) => item === $cell.pos - start);
  // @ts-expect-error: Unreachable code error
  const lastIndex = map.map.findLastIndex(item => item === $cell.pos - start);
  if (index !== lastIndex) {
    index = Math.min(index + col - 1, lastIndex);
  }
  for (let row = 0; row < map.width; row++) {
    // 获取到当前单元格在map.map中的index 在左边的index-- 右边的index++ 以此类推渲染
    let cellPos = map.map[index];
    if (row !== col - 1) {
      const extraIndex = index - (col - 1) + row;
      cellPos = map.map[extraIndex];
      // 如果出现合并行的问题 需要处理一下不让出现拖拽的线条
      if (cellPos === map.map[extraIndex + map.width]) {
        continue;
      }
    }
    const pos = start + cellPos + table.nodeAt(cellPos)!.nodeSize - 1;
    const dom = document.createElement('div');
    dom.className = 'row-resize-handle';
    dom.style.width = '1000px';
    decorations.push(Decoration.widget(pos, dom));
    // 占位DOM 用于移动时改变行高
    const placeholderDom = document.createElement('div');
    placeholderDom.className = 'placeholder-dom';
    decorations.push(Decoration.widget(pos, placeholderDom));
  }
  return DecorationSet.create(state.doc, decorations);
}
