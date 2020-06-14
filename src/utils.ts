
import { 
  MODEL_STORE_NAME, INFO_STORE_NAME, WEIGHTS_STORE_NAME, DATABASE_VERSION, DATABASE_NAME 
} from './globals';


export function promisifyRequest(req: IDBRequest) {
  return new Promise((resolve, reject) => {
    req.onsuccess = e => resolve(req.result);
    req.onerror = e => reject(req.error);
  });
}

export function stringByteLength(str: string) {
  return new Blob([str]).size;
}

export function concatenateArrayBuffers(buffers: any) {
  let totalByteLength = 0;
  buffers.forEach((buffer: any) => {
    totalByteLength += buffer.byteLength;
  });

  const temp = new Uint8Array(totalByteLength);
  let offset = 0;
  buffers.forEach((buffer: any) => {
    temp.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  return temp.buffer;
}


export function openDatabase() {
  return new Promise((resolve, reject) => {
    const openRequest: IDBOpenDBRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    openRequest.onupgradeneeded = () => _setUpDatabase(openRequest);
    openRequest.onsuccess = (res: any) => resolve(res.target.result);
    openRequest.onerror = (err) => reject(err);
  });
}

function _setUpDatabase(openRequest: IDBOpenDBRequest) {
  const db = openRequest.result;
  db.createObjectStore(MODEL_STORE_NAME, {keyPath: 'modelPath'});
  db.createObjectStore(INFO_STORE_NAME, {keyPath: 'modelPath'});
  db.createObjectStore(WEIGHTS_STORE_NAME, {keyPath: 'chunckId'});
}

export function deleteDatabase() {
  const theWindow: any = window;
  const factory = theWindow.indexedDB || theWindow.mozIndexedDB ||
      theWindow.webkitIndexedDB || theWindow.msIndexedDB ||
      theWindow.shimIndexedDB;
  if (factory == null) {
    throw new Error(
      'The current browser does not appear to support IndexedDB.');
  }

  return new Promise((resolve, reject) => {
    const deleteRequest = factory.deleteDatabase(DATABASE_NAME);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = (error: Error) => reject(error);
  });
}

