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

export default self =>
  self.addEventListener('message', ({data}) => {
    const {frame, instanceN, clipN, frameN} = data
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

    self.postMessage({
      payload: [new Float32Array(positions), new Uint16Array(indices)],
      instanceN,
      clipN,
      frameN
    })
  })
