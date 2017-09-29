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

import {setStyles, makeDiv, makeEl, on} from './utils'

const arrowIcon = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5
vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOS42MiAzOC4wMyI+PHBhdGggZmlsbD0iIzcwNzE3MSI
gZD0iTTguNzYsNDMuN2EuMzcuMzcsMCwwLDEtLjI2LS42NEwyNy4xLDI0LjU1LDguODYsNi4zMmEuMzg
uMzgsMCwwLDEsLjUzLS41M2wxOC41LDE4LjVhLjM4LjM4LDAsMCwxLDAsLjUzTDksNDMuNTlBLjM3LjM
3LDAsMCwxLDguNzYsNDMuN1oiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC04LjM4IC01LjY4KSIvPjwvc3Z
nPg==`

export const makeArrow = right => {
  const el = document.createElement('img')
  el.src = arrowIcon
  setStyles(el, {
    width: '3%',
    pointerEvents: 'auto',
    cursor: 'pointer',
    transform: right ? 'none' : 'rotate(180deg)',
    padding: '0 5%',
    boxSizing: 'content-box'
  })
  return el
}

export const makeLoadingText = () => {
  const el = makeDiv()
  el.innerText = 'loading...'
  setStyles(el, {
    position: 'absolute',
    zIndex: '1000',
    top: '50%',
    width: '100%',
    textAlign: 'center',
    fontSize: '2em',
    pointerEvents: 'none',
    transform: 'translateY(-50%)',
    color: '#707070'
  })
  return el
}

export const makeConfigPanel = norman => {
  const configEl = makeDiv()
  configEl.className = 'norman-config'
  setStyles(configEl, {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#000',
    color: '#fff',
    padding: '5px 10px'
  })
  ;['autoRotate', 'spinScrub', 'breathing', 'invertOnClick'].forEach(k => {
    const el = makeDiv()
    el.style.margin = '5px 0'
    const check = makeEl('input')
    check.type = 'checkbox'
    check.checked = norman.config[k]
    el.appendChild(check)
    const label = makeEl('label')
    label.innerText = k
    label.style.marginLeft = '10px'
    el.appendChild(label)
    on(el, 'click', () => {
      norman.setConfig({[k]: !norman.config[k]})
      check.checked = norman.config[k]
    })
    configEl.appendChild(el)
  })

  return configEl
}

export const makeNav = norman => {
  const navEl = makeDiv()
  navEl.className = 'norman-nav'
  setStyles(navEl, {
    position: 'absolute',
    top: '50%',
    left: '0',
    right: '0',
    fontSize: '50px',
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    transform: 'translateY(-50%)'
  })
  ;['Prev', 'Next'].forEach((k, i) => {
    const el = makeArrow(!!i)
    on(el, 'click', norman['show' + k])
    navEl.appendChild(el)
  })
  return navEl
}
