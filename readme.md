# tfjs-model-load-util

this is a utilities funciton to help load tfjs models from indexedDB if any.


## API
```ts

// fetch tf models from remote and store it in indexedDB for cache.
export async function fetchAndStoreArtifact(modelUrl: string, modelName: string): Promise<tf.io.ModelArtifacts> 


// get tf models from cache, if cache failed then fetch from remote.
export async function loadArtifactFromCache(modelUrl: string, modelName: string): Promise<tf.io.ModelArtifacts>


// return a loader object as input for  tf.loadGraphModel or tf.loadLayerModel
export function createCustomLoader(modelUrl: string, modelName: string): tf.io.IOHandler

```



