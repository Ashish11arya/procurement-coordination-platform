import { Types } from 'mongoose';

export function createMockModel<T extends { _id?: any }>(initialData: any[] = []) {
  const store: any[] = [...initialData];

  class MockModel {
    [key: string]: any;

    constructor(data: any) {
      Object.assign(this, data);
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
      if (this.tokenVersion === undefined) {
        this.tokenVersion = 1;
      }
      if (this.isActive === undefined) {
        this.isActive = true;
      }
    }

    async save() {
      const idx = store.findIndex((item) => item._id.toString() === this._id.toString());
      const doc = { ...this };
      if (idx >= 0) {
        store[idx] = doc;
      } else {
        store.push(doc);
      }
      return this;
    }

    toObject() {
      return { ...this };
    }

    static async create(data: any) {
      const doc = new MockModel(data);
      await doc.save();
      return doc;
    }

    static findOne(query: any) {
      const filterFn = createFilterFn(query);
      return {
        select: function () {
          return this;
        },
        exec: async function () {
          const found = store.find(filterFn);
          if (!found) return null;
          const inst = new MockModel(found);
          return inst;
        },
      };
    }

    static findById(id: any) {
      const idStr = id?.toString();
      return {
        select: function () {
          return this;
        },
        exec: async function () {
          const found = store.find((item) => item._id.toString() === idStr);
          if (!found) return null;
          return new MockModel(found);
        },
      };
    }

    static find(query: any = {}) {
      const filterFn = createFilterFn(query);
      return {
        sort: function () {
          return this;
        },
        skip: function () {
          return this;
        },
        limit: function () {
          return this;
        },
        exec: async function () {
          return store.filter(filterFn).map((item) => new MockModel(item));
        },
      };
    }

    static async updateOne(query: any, update: any) {
      const filterFn = createFilterFn(query);
      const item = store.find(filterFn);
      if (item) {
        applyUpdate(item, update);
      }
      return { modifiedCount: item ? 1 : 0 };
    }

    static async updateMany(query: any, update: any) {
      const filterFn = createFilterFn(query);
      let count = 0;
      for (const item of store) {
        if (filterFn(item)) {
          applyUpdate(item, update);
          count++;
        }
      }
      return { modifiedCount: count };
    }

    static async insertMany(items: any[]) {
      const docs = items.map((i) => {
        const doc = new MockModel(i);
        store.push(doc);
        return doc;
      });
      return docs;
    }

    static findOneAndUpdate(query: any, update: any, options: any = {}) {
      const filterFn = createFilterFn(query);
      const item = store.find(filterFn);
      let resultDoc: any = null;
      if (item) {
        applyUpdate(item, update);
        resultDoc = new MockModel(item);
      }
      return {
        exec: async () => resultDoc,
        then: (resolve: any, reject: any) => Promise.resolve(resultDoc).then(resolve, reject),
      };
    }

    static findByIdAndUpdate(id: any, update: any) {
      const idStr = id?.toString();
      const item = store.find((i) => i._id.toString() === idStr);
      if (item) {
        applyUpdate(item, update);
        return new MockModel(item);
      }
      return null;
    }

    static countDocuments(query: any = {}) {
      const filterFn = createFilterFn(query);
      return {
        exec: async function () {
          return store.filter(filterFn).length;
        },
      };
    }

    static _getStore() {
      return store;
    }
  }

  return MockModel;
}

function createFilterFn(query: any) {
  return (item: any) => {
    if (!query || Object.keys(query).length === 0) return true;

    // Handle $or
    if (query.$or && Array.isArray(query.$or)) {
      return query.$or.some((subQuery: any) => createFilterFn(subQuery)(item));
    }

    for (const [key, val] of Object.entries(query)) {
      if (key === '_id' || key === 'userId') {
        const itemVal = item[key]?.toString();
        const targetVal = val?.toString();
        if (itemVal !== targetVal) return false;
      } else if (typeof val === 'object' && val !== null) {
        if (val instanceof Types.ObjectId) {
          if (item[key]?.toString() !== val.toString()) return false;
        } else if ((val as any).$in && Array.isArray((val as any).$in)) {
          if (!(val as any).$in.includes(item[key])) return false;
        } else if ((val as any).$lte !== undefined) {
          if ((item[key] || 0) > (val as any).$lte) return false;
        } else if ((val as any).$gte !== undefined) {
          if ((item[key] || 0) < (val as any).$gte) return false;
        } else if (item[key] !== val) {
          return false;
        }
      } else {
        if (item[key] !== val) return false;
      }
    }
    return true;
  };
}

function applyUpdate(target: any, update: any) {
  if (update.$inc) {
    for (const [key, incVal] of Object.entries(update.$inc)) {
      target[key] = (target[key] || 0) + (incVal as number);
    }
  }
  if (update.$set) {
    for (const [key, setVal] of Object.entries(update.$set)) {
      target[key] = setVal;
    }
  }
  for (const [key, val] of Object.entries(update)) {
    if (!key.startsWith('$')) {
      target[key] = val;
    }
  }
}
