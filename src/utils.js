// Copyright 2017 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export const {PI} = Math
export const TAU = PI * 2
export const poolSize = (navigator.hardwareConcurrency || 2) - 1

export const logErr = console.error.bind(console)

export const takeKeys = (o, ks) =>
  ks.reduce((a, k) => {
    a[k] = o[k]
    return a
  }, {})

export const on = (el, ev, fn) => el.addEventListener(ev, fn)

export const clamp = (min, max, n) => Math.min(max, Math.max(min, n))

export const fpsToMs = fps => 1000 / fps

export const makeEl = document.createElement.bind(document)
export const makeDiv = document.createElement.bind(document, 'div')

export const setStyles = (el, styles) =>
  Object.entries(styles).forEach(([k, v]) => (el.style[k] = v))

export const splitColor = (color, keyPrefix = '') =>
  ['r', 'g', 'b'].reduce((a, k) => {
    a[keyPrefix + k] = color[k]
    return a
  }, {})

export const isTouch = window.TouchEvent
  ? e => e instanceof TouchEvent
  : () => false

export const whenIdle = window.requestIdleCallback || setTimeout

export const isTouchDevice = 'ontouchstart' in window
