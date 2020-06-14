import * as tf from '@tensorflow/tfjs';
import { MODEL_STORE_NAME, INFO_STORE_NAME, WEIGHTS_STORE_NAME } from './globals';
import * as utils from './utils';
import rollback from './rollback.js';

// Saving in chuncks allows to store bigger models.
const MAX_CHUNCK_SIZE = 500000000; // 50MB

export default {
  db: null,

  async fetchArtifactsFromUrl(url: string): Promise<tf.io.ModelArtifacts> {
    const loadHandlers = tf.io.getLoadHandlers(url);
    const modelArtifacts: tf.io.ModelArtifacts = await loadHandlers[0].load();
    return modelArtifacts;
  },


  async storeAction(modelArtifacts: tf.io.ModelArtifacts, path: string) {
    this.db = await utils.openDatabase();
    
    const modelArtifactsInfo = this._getModelArtifactsInfoForJSON(modelArtifacts);
    const hasWeights = modelArtifacts.weightData !== null;
    await this._saveModelArtifactsInfo(path, modelArtifactsInfo);

    if (hasWeights) {
      modelArtifacts = await this._parseModelWeights(modelArtifacts, path);
      await this._saveModelWeights(modelArtifacts, path);
    }

    await this._saveModelArtifacts(path, modelArtifacts);
    this.db.close();

    return modelArtifactsInfo;
  },

  async _saveModelArtifactsInfo(path: string, modelArtifactsInfo: any) {
    const infoTx = this.db.transaction(INFO_STORE_NAME, 'readwrite');
    const infoStore = infoTx.objectStore(INFO_STORE_NAME);

    try {
      await utils.promisifyRequest(
        infoStore.put({
          modelPath: path,
          modelArtifactsInfo
        })
      );
    } catch (error) {
      this.db.close();
      throw new Error(error);
    }
  },

  async _saveModelWeights(modelArtifacts: any, modelPath: string) {
    const chunckIds = modelArtifacts.weightChunckKeys;
    try {
      await Promise.all(chunckIds.map(async (chunckId: string, i: number) => {
        const weightTx = this.db.transaction(WEIGHTS_STORE_NAME, 'readwrite');
        const weightsStore = weightTx.objectStore(WEIGHTS_STORE_NAME);

        const start = i * MAX_CHUNCK_SIZE;
        const end = start + MAX_CHUNCK_SIZE < modelArtifacts.weightData.byteLength ? 
          start + MAX_CHUNCK_SIZE :
          modelArtifacts.weightData.byteLength;

        const weightData = modelArtifacts.weightData.slice(start, end);

        try {
          await utils.promisifyRequest(
            weightsStore.put({
              chunckId,
              weightData,
            })
          );
        } catch (err) {
          throw new Error(err);
        }
      }));
    } catch (error) {
      // If the put-model request fails, roll back the info entry as
      // well. If rollback fails, reject with error that triggered the
      // rollback initially.
      rollback.array(this.db, WEIGHTS_STORE_NAME, chunckIds).catch((err) => {});
      rollback.single(this.db, INFO_STORE_NAME, modelPath).catch((err) => {});
      this.db.close();
      throw new Error(error);
    }

    modelArtifacts.weightData = null;

    return modelArtifacts;
  },

  async _saveModelArtifacts(modelPath: string, modelArtifacts: any) {
    const modelTx = this.db.transaction(MODEL_STORE_NAME, 'readwrite');
    const modelStore = modelTx.objectStore(MODEL_STORE_NAME);
    try {
      await utils.promisifyRequest(
        modelStore.put({
          modelPath,
          modelArtifacts,
        })
      );
    } catch (error) {
      // If the put-model request fails, roll back the info entry as
      // well. If rollback fails, reject with error that triggered the
      // rollback initially.
      await rollback.single(this.db, INFO_STORE_NAME, modelPath);
      this.db.close();
      throw new Error(error);
    }
  },

  async _parseModelWeights(modelArtifacts: any, modelPath: string) {
    if (modelArtifacts.weightData === null) {
      modelArtifacts.weightChunckKeys = null;
      return modelArtifacts;
    }

    const amountOfChuncks = Math.ceil(modelArtifacts.weightData.byteLength / MAX_CHUNCK_SIZE);
    const chunckIds = Array.from(Array(amountOfChuncks).keys()).map((item, i) => {
      return `${modelPath}_${i}`;
    });

    modelArtifacts.weightChunckKeys = chunckIds;

    return modelArtifacts;
  },

  

  _getModelArtifactsInfoForJSON(modelArtifacts: any) {
    return {
      dateSaved: new Date(),
      modelTopologyType: 'JSON',
      modelTopologyBytes: modelArtifacts.modelTopology == null ?
        0 :
        utils.stringByteLength(JSON.stringify(modelArtifacts.modelTopology)),
      weightSpecsBytes: modelArtifacts.weightSpecs == null ?
        0 :
        utils.stringByteLength(JSON.stringify(modelArtifacts.weightSpecs)),
      weightDataBytes: modelArtifacts.weightData == null ?
        0 :
        modelArtifacts.weightData.byteLength,
    };
  },


  async loadAction(path: string) {
    this.db = await utils.openDatabase();
    const idbModel: any = await this._loadModel(path);
    if (idbModel instanceof Error || !idbModel) {
      this.db.close();
      return undefined;
    }
    const modelArtifacts = await this._loadWeights(idbModel.modelArtifacts);
    if (modelArtifacts instanceof Error || !modelArtifacts) {
      this.db.close();
      return undefined;
    }
    this.db.close();
    return modelArtifacts;
  },

  
  async _loadWeights(artifacts: any) {
    const modelArtifacts = artifacts;

    if (modelArtifacts.weightChunckKeys !== undefined) {
      const weightDataChuncked = await Promise.all(modelArtifacts.weightChunckKeys.map(async (chunckKey: string) => {
        const weightTx = this.db.transaction(WEIGHTS_STORE_NAME, 'readwrite');
        const weightsStore = weightTx.objectStore(WEIGHTS_STORE_NAME);
        const weightDataChunck: any = await utils.promisifyRequest(weightsStore.get(chunckKey));
        return weightDataChunck.weightData;
      }));

      const weightData = utils.concatenateArrayBuffers(weightDataChuncked);
      modelArtifacts.weightData = weightData;
    }

    return modelArtifacts;
  },

  async _loadModel(path: string) {
    const modelTx = this.db.transaction(MODEL_STORE_NAME, 'readonly');
    const modelStore = modelTx.objectStore(MODEL_STORE_NAME);
    const model = await utils.promisifyRequest(modelStore.get(path));

    if (model == null) {
      this.db.close();
      return new Error( `Cannot find model with path '${path}' ` + 'in IndexedDB.');
    }
    return model;
  },

};

