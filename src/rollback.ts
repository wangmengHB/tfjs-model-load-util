export default {
  array(db: any, storeName: string, keyPaths: any) {
    return new Promise(async (resolve, reject) => {
      await Promise.all(keyPaths.map((keyPath: string) => {
        this.single(db, storeName, keyPath)
          .then(() => resolve())
          .catch(() => reject());
      }));
    });
  },

  single(db: any, storeName: string, keyPath: string) {
    return new Promise((resolve, reject) => {
      const storeTx = db.transaction(storeName, 'readwrite');
      const store = storeTx.objectStore(storeName);

      let deleteInfoRequest;
      try {
        deleteInfoRequest = store.delete(keyPath);
      } catch (err) {
        return reject(err);
      }

      deleteInfoRequest.onsuccess = () => {
        return resolve();
      };
      deleteInfoRequest.onerror = (error: Error) => {
        return reject(error);
      };
    });
  }
};