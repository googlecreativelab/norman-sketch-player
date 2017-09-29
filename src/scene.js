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

import * as THREE from 'THREE'
import {clamp} from './utils'

const materials = {}

const getMaterial = color => {
  const key = color instanceof THREE.Color ? '#' + color.getHexString() : color

  if (materials[key]) {
    return materials[key]
  }
  materials[key] = new THREE.LineBasicMaterial({color})
  return materials[key]
}

export default class NormanScene {
  constructor(data, {color}) {
    this.frameIndex = 0
    this.container = new THREE.Group()
    this.innerContainer = new THREE.Group()

    this.container.add(this.innerContainer)

    const material = getMaterial(color)

    this.clips = data.map(clip =>
      clip.map((frame, frameN) => {
        const geometry = new THREE.BufferGeometry()
        const positions = []
        const indices = []
        let nextIndex = 0

        frame.forEach(vertices => {
          if (!vertices.length) {
            return
          }

          const v = vertices[0]
          positions.push(v.x, v.y, v.z)
          nextIndex++

          vertices.forEach(v => {
            positions.push(v.x, v.y, v.z)
            indices.push(nextIndex - 1, nextIndex)
            nextIndex++
          })
        })

        geometry.setIndex(
          new THREE.BufferAttribute(new Uint16Array(indices), 1)
        )
        geometry.addAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(positions), 3)
        )
        geometry.attributes.position.needsUpdate = true

        const mesh = new THREE.LineSegments(geometry, material)
        mesh.visible = frameN === 0
        this.innerContainer.add(mesh)
        return mesh
      })
    )

    this.frameIndices = new Array(this.clips.length).fill(0)
    this.frameLimits = this.clips.map(clip => clip.length - 1)
  }

  tick(n = 1) {
    this.clips.forEach((clip, i) => {
      const index = this.frameIndices[i]
      const limit = this.frameLimits[i]
      let next = index + n
      next = next > limit ? 0 : next < 0 ? limit : next

      clip[index].visible = false
      clip[next].visible = true
      this.frameIndices[i] = next
    })
  }

  static setColor(id, val) {
    getMaterial(id).color = val
  }

  setFrame(percent) {
    const p = clamp(0, 1, percent)
    this.clips.forEach((clip, i) => {
      clip[this.frameIndices[i]].visible = false
      const next = Math.floor(this.frameLimits[i] * p)
      clip[next].visible = true
      this.frameIndices[i] = next
    })
  }
}
