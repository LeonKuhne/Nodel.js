import { NodelRender } from './renderer.mjs'
import { NodelManager } from './manager.mjs'
import { NodelListener } from './listener.mjs'

export const Render = new NodelRender()
export const Manage = new NodelManager(Render)
export const Listen = new NodelListener(Manage, Render)