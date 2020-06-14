
import cache from './cache';

const indexedDBSupported = !!(
  window.indexedDB || 
  (window as any).mozIndexedDB || 
  (window as any).webkitIndexedDB || 
  (window as any).msIndexedDB
);


async function loadAndStoreArtifact(modelUrl: string, modelName: string) {
  const artifacts = await cache.fetchArtifactsFromUrl(modelUrl);
  await cache.storeAction(artifacts, modelName);
  const model = await cache.loadAction(modelName);
  return model;
}
  

export async function loadArtifactFromCache(modelUrl: string, modelName: string) {
  if (!indexedDBSupported) {
    return await cache.fetchArtifactsFromUrl(modelUrl);
  }
  let artifacts = await cache.loadAction(modelName);
  if (!artifacts) {
    artifacts = await loadAndStoreArtifact(modelUrl, modelName);
  }
  if (!artifacts) {
    throw new Error('failed to get model.');
  }
  return artifacts;
}

export function createCustomLoader(modelUrl: string, modelName: string) {
  return {
    load: async () => {
      if (!indexedDBSupported) {
        return await cache.fetchArtifactsFromUrl(modelUrl);
      }
      let modelArtifact  = await loadArtifactFromCache(modelUrl, modelName);
      return modelArtifact;
    }
  }

}

