/**
 * Raycast & Screen-Space Sightline Occlusion Guard (SHORT-03A).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-03A).
 * Detects scene geometry blocking camera sightlines to semantic faces, hands, and story props,
 * and safely nudges camera placement or hides explicitly optional decorative blockers without
 * removing story-critical props.
 */

import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();
const tmpOrigin = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();

/**
 * Checks whether line-of-sight from camera to named targets is obstructed by occluder meshes.
 * targets: Array<{ id, role: 'face'|'hand'|'prop', point: [x,y,z] }>
 * occluders: Array<THREE.Object3D>
 */
export function detectOcclusion(camera, targets, occluders = [], options = {}) {
  const minClearDistRatio = options.minClearDistRatio ?? 0.96;
  camera.updateMatrixWorld();
  tmpOrigin.copy(camera.position);

  const validOccluders = occluders.filter(
    (obj) => obj && obj.visible !== false && !obj.userData?.intentionalForeground
  );

  const results = [];
  const blockingMeshes = [];

  for (const tgt of targets) {
    tmpTarget.set(tgt.point[0], tgt.point[1], tgt.point[2]);
    tmpDir.subVectors(tmpTarget, tmpOrigin);
    const totalDist = tmpDir.length();
    if (totalDist < 1e-4) {
      results.push({ id: tgt.id, role: tgt.role, occluded: false, blocker: null, clearRatio: 1 });
      continue;
    }
    tmpDir.divideScalar(totalDist);
    raycaster.set(tmpOrigin, tmpDir);
    raycaster.near = 0.05;
    raycaster.far = totalDist * minClearDistRatio;

    const hits = raycaster.intersectObjects(validOccluders, true).filter(
      (h) => h.object && h.object.visible && !h.object.userData?.intentionalForeground && !h.object.userData?.ignoreOcclusion
    );

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const blockerName = hitObj.name || hitObj.userData?.propId || 'world-geometry';
      const nonEssential = Boolean(hitObj.userData?.nonEssentialProp);
      blockingMeshes.push({ mesh: hitObj, nonEssential, distance: hits[0].distance });
      results.push({
        id: tgt.id,
        role: tgt.role,
        occluded: true,
        blocker: blockerName,
        nonEssential,
        hitDistance: Number(hits[0].distance.toFixed(3)),
        targetDistance: Number(totalDist.toFixed(3)),
        clearRatio: Number((hits[0].distance / totalDist).toFixed(3)),
      });
    } else {
      results.push({
        id: tgt.id,
        role: tgt.role,
        occluded: false,
        blocker: null,
        nonEssential: false,
        hitDistance: null,
        targetDistance: Number(totalDist.toFixed(3)),
        clearRatio: 1.0,
      });
    }
  }

  return {
    anyOccluded: results.some((r) => r.occluded),
    blockedIds: results.filter((r) => r.occluded).map((r) => r.id),
    targets: results,
    blockingMeshes,
  };
}

/**
 * Attempts safe deterministic staging conflict resolution:
 * 1) Hides non-essential decorative blockers if flagged `userData.nonEssentialProp === true` (never storyCritical).
 * 2) Tests small deterministic lateral/vertical camera nudges to regain clear line-of-sight.
 */
export function resolveStagingConflict(camera, cameraState, targets, occluders = [], options = {}) {
  const initial = detectOcclusion(camera, targets, occluders, options);
  if (!initial.anyOccluded) {
    return {
      resolved: true,
      actionsTaken: [],
      cameraState,
      occlusion: initial,
    };
  }

  const actionsTaken = [];
  for (const b of initial.blockingMeshes) {
    if (b.nonEssential && !b.mesh.userData?.storyCritical) {
      b.mesh.visible = false;
      actionsTaken.push({ type: 'hide_non_essential', target: b.mesh.name || b.mesh.userData?.propId || 'prop' });
    }
  }

  if (actionsTaken.length > 0) {
    const afterHide = detectOcclusion(camera, targets, occluders, options);
    if (!afterHide.anyOccluded) {
      return { resolved: true, actionsTaken, cameraState, occlusion: afterHide };
    }
  }

  // Test gentle non-intrusive offsets around original camera position
  const origPos = [...cameraState.pos];
  const candidateOffsets = options.offsets || [
    [0, 0.22, 0],
    [-0.28, 0.14, 0],
    [0.28, 0.14, 0],
    [-0.45, 0.25, 0.15],
    [0.45, 0.25, 0.15],
  ];

  let best = initial;
  let bestState = cameraState;

  for (const off of candidateOffsets) {
    camera.position.set(origPos[0] + off[0], origPos[1] + off[1], origPos[2] + off[2]);
    camera.lookAt(cameraState.look[0], cameraState.look[1], cameraState.look[2]);
    camera.updateMatrixWorld();
    const probe = detectOcclusion(camera, targets, occluders, options);
    if (!probe.anyOccluded) {
      const nudged = {
        ...cameraState,
        pos: [origPos[0] + off[0], origPos[1] + off[1], origPos[2] + off[2]],
      };
      actionsTaken.push({ type: 'nudge_camera', offset: off });
      return { resolved: true, actionsTaken, cameraState: nudged, occlusion: probe };
    }
    if (probe.blockedIds.length < best.blockedIds.length) {
      best = probe;
      bestState = {
        ...cameraState,
        pos: [origPos[0] + off[0], origPos[1] + off[1], origPos[2] + off[2]],
      };
    }
  }

  // Restore best camera state evaluated
  camera.position.set(bestState.pos[0], bestState.pos[1], bestState.pos[2]);
  camera.lookAt(bestState.look[0], bestState.look[1], bestState.look[2]);
  camera.updateMatrixWorld();
  return {
    resolved: !best.anyOccluded,
    actionsTaken,
    cameraState: bestState,
    occlusion: best,
  };
}
