'use strict';

// Helper functions

function uniqueId() {
  return String(Math.random().toString(16).slice(2))
}

function arrRemove(arr, elem) {
  const idx = arr.indexOf(elem)
  if (idx > -1) {
    arr.splice(idx, 1)
  }
}

function findTemplates() {
  const nodel = document.getElementById('nodel')
  const templates = nodel.children
  const templateIds = []

  for (let idx = 0; idx < templates.length; idx++) {
    const elem = templates[idx]
    templateIds.push(elem.id)
  }

  return templateIds
}

function toRegPos(node) {
  const nodel = document.getElementById('nodel')
  const elemX = node.x + nodel.offsetWidth/2
  const elemY = node.y + nodel.offsetHeight/2
  return [elemX, elemY]
}

