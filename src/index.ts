
import cache from './cache';
import * as tf from '@tensorflow/tfjs';

const indexedDBSupported = !!(
  window.indexedDB || 
  (window as any).mozIndexedDB || 
  (window as any).webkitIndexedDB || 
  (window as any).msIndexedDB
);


export async function fetchAndStoreArtifact(modelUrl: string, modelName: string): Promise<tf.io.ModelArtifacts> {
  const artifacts: tf.io.ModelArtifacts  = await cache.fetchArtifactsFromUrl(modelUrl);
  await cache.storeAction(artifacts, modelName);
  const model: tf.io.ModelArtifacts = await cache.loadAction(modelName);
  return model;
}
  

export async function loadArtifactFromCache(modelUrl: string, modelName: string): Promise<tf.io.ModelArtifacts> {
  if (!indexedDBSupported) {
    console.error('indexedDB is not supported, cache mechanism failed.');
    return await cache.fetchArtifactsFromUrl(modelUrl);
  }
  let artifacts = await cache.loadAction(modelName);
  if (!artifacts) {
    artifacts = await fetchAndStoreArtifact(modelUrl, modelName);
  }
  if (!artifacts) {
    throw new Error('failed to get model.');
  }
  return artifacts;
}

export function createCustomLoader(modelUrl: string, modelName: string): tf.io.IOHandler {
  return {
    load: async (): Promise<tf.io.ModelArtifacts>  => {
      if (!indexedDBSupported) {
        return await cache.fetchArtifactsFromUrl(modelUrl) ;
      }
      let modelArtifact: tf.io.ModelArtifacts  = await loadArtifactFromCache(modelUrl, modelName);
      return modelArtifact;
    }
  };

}

