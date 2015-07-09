/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow $FlowFixMe
 * Broken:
 * - not recognizing assignment to cancel out the "possibly null value"
 * - not understanding document.createElement
 */
'use strict';

import type {DOMNode, DOMEvent} from './types'

function subscribeCapture(obj, evt, cb) {
  obj.addEventListener(evt, cb, true);
  return () => obj.removeEventListener(evt, cb, true);
}

class Highlighter {
  overlay: ?Overlay;
  win: Object;
  onSelect: () => void;
  inspecting: boolean;
  inspected: DOMNode;
  _subs: Array<() => void>;
  _button: DOMNode;

  constructor(win: Object, onSelect: (node: Object) => void) {
    this.win = win;
    this.onSelect = onSelect;
    this.overlay = null;
    this.manyOverlay = null;
    this._subs = [
      subscribeCapture(this.win, 'mouseover', this.onHover.bind(this)),
      subscribeCapture(this.win, 'mousedown', this.onMouseDown.bind(this)),
      subscribeCapture(this.win, 'click', this.onClick.bind(this)),
    ];
  }

  startInspecting() {
    this.inspecting = true;
  }

  stopInspecting() {
    this._subs.forEach(unsub => unsub());
    this.hideHighlight();
    if (this._button && this._button.parentNode) {
      this._button.parentNode.removeChild(this._button);
    }
  }

  highlight(node: DOMNode, name?: string) {
    this.removeMultiOverlay();
    if (!this.overlay) {
      this.overlay = new Overlay(this.win);
    }
    this.inspected = node;
    this.overlay.inspect(node, name);
  }

  highlightMany(nodes: Array<DOMNode>) {
    this.removeOverlay();
    if (!this.multiOverlay) {
      this.multiOverlay = new MultiOverlay(this.win);
    }
    this.multiOverlay.highlightMany(nodes);
  }

  hideHighlight() {
    this.inspecting = false;
    this.removeOverlay();
    this.removeMultiOverlay();
  }

  removeOverlay() {
    if (!this.overlay) {
      return;
    }
    this.overlay.remove();
    this.overlay = null;
  }

  removeMultiOverlay() {
    if (!this.multiOverlay) {
      return;
    }
    this.multiOverlay.remove();
    this.multiOverlay = null;
  }

  onMouseDown(evt: DOMEvent) {
    if (!this.inspecting) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    evt.cancelBubble = true;
    this.onSelect(evt.target);
    return;
  }

  onClick(evt: DOMEvent) {
    if (!this.inspecting) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    evt.cancelBubble = true;
    this.hideHighlight();
  }

  onHover(evt: DOMEvent) {
    if (!this.inspecting) {
      return;
    }
    evt.preventDefault();
    evt.stopPropagation();
    evt.cancelBubble = true;
    this.highlight(evt.target);
  }

  inject() {
    this._button = makeMagnifier();
    this._button.onclick = this.startInspecting.bind(this);
    this.win.document.body.appendChild(this._button);
  }
}

function makeMagnifier() {
  var button = document.createElement('button');
  button.innerHTML = '&#128269;';
  button.style.backgroundColor = 'transparent';
  button.style.border = 'none';
  button.style.outline = 'none';
  button.style.cursor = 'pointer';
  button.style.position = 'fixed';
  button.style.bottom = '10px';
  button.style.right = '10px';
  button.style.fontSize = '30px';
  button.style.zIndex = 10000000;
  return button;
}

var overlayStyles = {
  background: 'rgba(120, 170, 210, 0.7)',
  padding: 'rgba(77, 200, 0, 0.3)',
  margin: 'rgba(255, 155, 0, 0.3)',
  border: 'rgba(255, 200, 50, 0.3)',
};

function setStyle(node, style) {
  for (var name in style) {
    node.style[name] = style[name];
  }
}

function boxWrap(dims, what, node) {
  setStyle(node, {
    borderTopWidth: dims[what + 'Top'] + 'px',
    borderLeftWidth: dims[what + 'Left'] + 'px',
    borderRightWidth: dims[what + 'Right'] + 'px',
    borderBottomWidth: dims[what + 'Bottom'] + 'px',
    borderStyle: 'solid',
  });
}

class MultiOverlay {
  constructor(window) {
    this.win = window;
    var doc = window.document;
    this.container = doc.createElement('div');
    doc.body.appendChild(this.container);
  }

  highlightMany(nodes) {
    this.container.innerHTML = '';
    nodes.forEach(node => {
      var div = this.win.document.createElement('div');
      var pos = nodePos(node);
      setStyle(div, {
        top: pos.top + 'px',
        left: pos.left + 'px',
        width: node.offsetWidth + 'px',
        height: node.offsetHeight + 'px',
        border: '2px dotted rgba(200, 100, 100, .8)',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(200, 100, 100, .2)',
        position: 'absolute',
        zIndex: 100000,
        pointerEvents: 'none',
      });
      this.container.appendChild(div);
    });
  }

  remove() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

class Overlay {
  win: Object;
  container: DOMNode;
  node: DOMNode;
  border: DOMNode;
  padding: DOMNode;
  content: DOMNode;
  tip: DOMNode;
  nameSpan: DOMNode;
  dimSpan: DOMNode;

  constructor(window) {
    var doc = window.document;
    this.win = window;
    this.container = doc.createElement('div');
    this.node = doc.createElement('div');
    this.border = doc.createElement('div');
    this.padding = doc.createElement('div');
    this.content = doc.createElement('div');

    this.border.style.borderColor = overlayStyles.border;
    this.padding.style.borderColor = overlayStyles.padding;
    this.content.style.backgroundColor = overlayStyles.background;

    setStyle(this.node, {
      borderColor: overlayStyles.margin,
      pointerEvents: 'none',
      position: 'fixed',
    });

    this.tip = doc.createElement('div');
    setStyle(this.tip, {
      border: '1px solid #aaa',
      backgroundColor: 'rgb(255, 255, 178)',
      fontFamily: 'sans-serif',
      color: 'orange',
      padding: '3px 5px',
      position: 'fixed',
      fontSize: '10px',
    });

    this.nameSpan = doc.createElement('span');
    this.tip.appendChild(this.nameSpan);
    setStyle(this.nameSpan, {
      color:   'rgb(136, 18, 128)',
      marginRight: '5px',
    });
    this.dimSpan = doc.createElement('span');
    this.tip.appendChild(this.dimSpan);
    setStyle(this.dimSpan, {
      color: '#888',
    });

    this.container.style.zIndex = 10000000;
    this.node.style.zIndex = 10000000;
    this.tip.style.zIndex = 10000000;
    this.container.appendChild(this.node);
    this.container.appendChild(this.tip);
    this.node.appendChild(this.border);
    this.border.appendChild(this.padding);
    this.padding.appendChild(this.content);
    doc.body.appendChild(this.container);
  }

  remove() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  inspect(node, name) {
    var pos = nodePos(node);
    var dims = getElementDimensions(node);

    boxWrap(dims, 'margin', this.node);
    boxWrap(dims, 'border', this.border);
    boxWrap(dims, 'padding', this.padding);

    setStyle(this.content, {
      height: node.offsetHeight - dims.borderTop - dims.borderBottom - dims.paddingTop - dims.paddingBottom + 'px',
      width: node.offsetWidth - dims.borderLeft - dims.borderRight - dims.paddingLeft - dims.paddingRight + 'px',
    });

    setStyle(this.node, {
      top: pos.top - dims.marginTop + 'px',
      left: pos.left - dims.marginLeft + 'px',
    });

    this.nameSpan.textContent = (name || node.nodeName.toLowerCase());
    this.dimSpan.textContent = node.offsetWidth + 'px × ' + node.offsetHeight + 'px'

    var tipPos = findTipPos({
      top: pos.top - dims.marginTop,
      left: pos.left - dims.marginLeft,
      height: node.offsetHeight + dims.marginTop + dims.marginBottom,
      width: node.offsetWidth + dims.marginLeft + dims.marginRight,
    }, this.win);

    setStyle(this.tip, tipPos);
  }
}

function findTipPos(dims, win) {
  var tipHeight = 20;
  var margin = 5;
  var top;
  if (dims.top + dims.height + tipHeight <= win.innerHeight) {
    if (dims.top + dims.height < 0) {
      top = margin;
    } else {
      top = dims.top + dims.height + margin;
    }
  } else if (dims.top - tipHeight <= win.innerHeight) {
    if (dims.top - tipHeight - margin < margin) {
      top = margin;
    } else {
      top = dims.top - tipHeight - margin;
    }
  } else {
    top = win.innerHeight - tipHeight - margin;
  }

  top += 'px';

  if (dims.left < 0) {
    return {top, left: 0};
  }
  if (dims.left + 200 > win.innerWidth) {
    return {top, right: 0};
  }
  return {top, left: dims.left + margin + 'px'};
}

/*
function findTipPos(dims, win) {
  var left = dims.left;
  var top = dims.top;
  if (left < 0) left = 0;
  if (left > win.innerWidth - 50) {
    left = win.innerWidth - 50;
  }
  if (top < 0) top = 0;
  if (top > win.innerHeight - 20) {
    top = win.innerHeight - 20;
  }
  return {top,left}
}
*/

function nodePos(node) {
  var left = node.offsetLeft;
  var top = node.offsetTop;
  while (node && node !== document.body && node.offsetParent) {
    var oP = node.offsetParent;
    var p = node.parentNode;
    while (p !== oP) {
      left -= p.scrollLeft;
      top -= p.scrollTop;
      p = p.parentNode;
    }
    left += oP.offsetLeft;
    top += oP.offsetTop;
    left -= oP.scrollLeft;
    top -= oP.scrollTop;
    node = oP;
  }
  if (window.scrollX) {
    left -= window.scrollX;
  }
  if (window.scrollY) {
    top -= window.scrollY;
  }
  return {left, top};
}

function getElementDimensions(element) {
  var calculatedStyle = window.getComputedStyle(element);

  return {
    borderLeft: +calculatedStyle.borderLeftWidth.match(/[0-9]*/)[0],
    borderRight: +calculatedStyle.borderRightWidth.match(/[0-9]*/)[0],
    borderTop: +calculatedStyle.borderTopWidth.match(/[0-9]*/)[0],
    borderBottom: +calculatedStyle.borderBottomWidth.match(/[0-9]*/)[0],
    marginLeft: +calculatedStyle.marginLeft.match(/[0-9]*/)[0],
    marginRight: +calculatedStyle.marginRight.match(/[0-9]*/)[0],
    marginTop: +calculatedStyle.marginTop.match(/[0-9]*/)[0],
    marginBottom: +calculatedStyle.marginBottom.match(/[0-9]*/)[0],
    paddingLeft: +calculatedStyle.paddingLeft.match(/[0-9]*/)[0],
    paddingRight: +calculatedStyle.paddingRight.match(/[0-9]*/)[0],
    paddingTop: +calculatedStyle.paddingTop.match(/[0-9]*/)[0],
    paddingBottom: +calculatedStyle.paddingBottom.match(/[0-9]*/)[0]
  };
}

module.exports = Highlighter;