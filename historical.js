"use strict";

var _      = require('lodash'),
    models = {};

module.exports = function (schema, options) {
    options            = options || {};
    var mongoose       = options.mongoose /* DEPRECATED */ || require('mongoose'),
        Schema         = mongoose.Schema,
        ObjectId       = Schema.Types.ObjectId,
        ignoredFields  = options.ignore || [],
        primaryKeyName = options.primaryKeyName || '_id';

    var getHistoricalModel = function (model) {
        var connection     = options.connection || model.constructor.collection.conn,
            name           = options.name || model.constructor.modelName + 's_historical',
            primaryKeyType = (options.primaryKeyType || /* DEPRECATED */ options.idType) || (model.constructor.schema.paths[primaryKeyName].options.type || ObjectId);

        if (!model.constructor.schema.paths[primaryKeyName]) {
            throw new Error('Historical error: Missing primary key `' + primaryKeyName + '` in schema `' + name + '`.');
        }

        var createHistoricalSchema = function() {
            var schema = new Schema({
                document: {type: primaryKeyType, index: true},
                timestamp: {type: Date, default: Date.now, index: true},
                diff: Schema.Types.Mixed
            });

            schema.pre('save', function(next) {
                var diff = this.diff;

                if(_.isArray(ignoredFields)) {
                    ignoredFields.forEach(function(field){
                        if(_.has(diff, field)) {
                            delete diff[field];
                        }
                    });
                }

                this.diff = diff;
                next();
            });

            return schema;
        };

        models[model.constructor.modelName] = models[model.constructor.modelName] ||
            connection.model(name, createHistoricalSchema());

        return models[model.constructor.modelName];
    };

    var arrayMerge = function (a, b) {
        return _.isArray(b) ? b : undefined;
    };

    var read = function (o, p) {
        for (var i = 0, a = p.split('.'), l = a.length; i < l; i++) {
            o = o[a[i]];
        }
        return o;
    };

    var write = function (o, p, v) {
        for (var i = 0, a = p.split('.'); i < a.length - 1; i++) {
            var n = a[i];
            if (n in o) {
                o = o[n];
            } else {
                o[n] = {};
                o    = o[n];
            }
        }
        o[a[a.length - 1]] = v;
    };

    // from https://stackoverflow.com/questions/10827108/mongoose-check-if-object-is-mongoose-object
    // by Lukasz Czerwinski
    var checkMongooseObject = function (v) {
        if (v === null) {
            return false;
        }
        return _.get(v, 'constructor.base') instanceof mongoose.Mongoose;
    }

    // from https://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string
    // by momo
    var startsWith = function (str, word) {
        return str.lastIndexOf(word, 0) === 0;
    }

    //CODE BETWEEN THESE COMMENT LINES WAS ADAPTED FROM THE MONGOOSE CODEBASE

    var shouldFlatten = function (val) {
        return val &&
            typeof val === 'object' &&
            !(val instanceof Date) &&
            !(val instanceof ObjectId) &&
            (!Array.isArray(val) || val.length > 0) &&
            !(val instanceof Buffer);
    }

    var _getPaths = function (update, path, result) {
        var keys = Object.keys(update || {});
        var numKeys = keys.length;
        result = result || [];
        path = path ? path + '.' : '';

        for (var i = 0; i < numKeys; ++i) {
            var key = keys[i];
            var val = update[key];

            result.push(path + key);
            if (checkMongooseObject(val) && !Buffer.isBuffer(val)) {
                val = val.toObject({ transform: false, virtuals: false });
            }
            if (shouldFlatten(val)) {
                _getPaths(val, path + key, result);
            }
        }

        return result;
    }

    var getPaths = function (update) {
        var res = [];
        var keys = Object.keys(update);
        var withoutDollarKeys = {};
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (startsWith(key, '$')) {
                _getPaths(update[key], '', res);
                continue;
            }
            withoutDollarKeys[key] = update[key];

        }
        _getPaths(withoutDollarKeys, '', res);

        return res;
    }
    //CODE BETWEEN THESE COMMENT LINES WAS ADAPTED FROM THE MONGOOSE CODEBASE

    schema.pre('save', function (next) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me),
            modified        = _.uniq(me.modifiedPaths()),
            diff            = this.isNew ? me.toObject({virtuals: false}) : {};

        if (!this.isNew) {
            modified.forEach(function (index) {
                var value = read(me.toObject({virtuals: false}), index);
                if (_.isPlainObject(value)) {
                    return;
                }
                if (value === undefined) {
                    write(diff, index, null);
                    return;
                }
                write(diff, index, value);
            });
        }

        var historical = new HistoricalModel({
            document: me[primaryKeyName],
            diff: diff
        });
        historical.save(next);
    });


    schema.post('findOneAndUpdate', function (next) {
        var update = this.getUpdate().$set,
            pathing = getPaths(this.getUpdate());

        this.model.findOne(update).exec().then(function(doc) {
            var me              = doc,
                HistoricalModel = getHistoricalModel(me),
                modified        = _.uniq(pathing),
                diff            = doc.isNew ? me.toObject({virtuals: false}) : {};

            if (!doc.isNew) {
                modified.forEach(function (index) {
                    var value = read(me.toObject({virtuals: false}), index);
                    if (_.isPlainObject(value)) {
                        return;
                    }
                    if (value === undefined) {
                        write(diff, index, null);
                        return;
                    }
                    write(diff, index, value);
                });
            }

            var historical = new HistoricalModel({
                document: me[primaryKeyName],
                diff: diff
            });

            historical.save(next);
        }).catch(function(e) {
            next(e);
        });
    });


    schema.post('findByIdAndUpdate', function (next) {
        var update = this.getUpdate().$set,
            pathing = getPaths(this.getUpdate());

        this.model.findOne(update).exec().then(function(doc) {
            var me              = doc,
                HistoricalModel = getHistoricalModel(me),
                modified        = _.uniq(pathing),
                diff            = doc.isNew ? me.toObject({virtuals: false}) : {};

            if (!doc.isNew) {
                modified.forEach(function (index) {
                    var value = read(me.toObject({virtuals: false}), index);
                    if (_.isPlainObject(value)) {
                        return;
                    }
                    if (value === undefined) {
                        write(diff, index, null);
                        return;
                    }
                    write(diff, index, value);
                });
            }

            var historical = new HistoricalModel({
                document: me[primaryKeyName],
                diff: diff
            });

            historical.save(next);
        }).catch(function (err) {
            next(err);
        });
    });


    schema.post('update', function () {

        var update = this.getUpdate().$set,
            pathing = getPaths(this.getUpdate());

        this.model.find(update).exec().then(function(docs) {
            return Promise.each(docs, function(doc){
                var me              = doc,
                    HistoricalModel = getHistoricalModel(me),
                    modified        = _.uniq(pathing),
                    diff            = {};

                modified.forEach(function (index) {
                    var value = read(me.toObject({virtuals: false}), index);
                    if (_.isPlainObject(value)) {
                        return;
                    }
                    if (value === undefined) {
                        write(diff, index, null);
                        return;
                    }
                    write(diff, index, value);
                });

                var historical = new HistoricalModel({
                    document: me[primaryKeyName],
                    diff: diff
                });

                return historical.save();
            });
        });
    });

    schema.pre('findOneAndRemove', function (next) {
        var query = this.getQuery();
        this.model.findOne(query).exec().then(function(doc) {
            var me              = doc,
                HistoricalModel = getHistoricalModel(me);

            var historical = new HistoricalModel({
                document: me[primaryKeyName],
                diff: null
            });
            historical.save(next);
        }).catch(function(e) {
            next(e);
        });
    });

    schema.pre('remove', function (next) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me);

        var historical = new HistoricalModel({
            document: me[primaryKeyName],
            diff: null
        });
        historical.save(next);
    });

    schema.methods.historicalSnapshot = function (callback) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (me.modifiedPaths().length) {
            return callback(new Error('Historical error: Attempted to snapshot an unsaved/modified document.'));
        }

        var snapshot = me.toObject();
        delete snapshot[primaryKeyName];
        delete snapshot.__v;

        var historical = new HistoricalModel({
            document: me[primaryKeyName],
            diff: snapshot
        });
        historical.save(function (e) {
            return e ? callback(e) : callback(null, me);
        });
    };

    schema.methods.historicalClear = function (callback) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        HistoricalModel.find({document: me[primaryKeyName]}, function (e, objs) {
            if (e) {
                return callback(e);
            }
            me.historicalSnapshot(function (e) {
                if (e) {
                    return callback(e);
                }
                objs.forEach(function (obj) {
                    obj.remove();
                });
                return callback(null, me);
            });
        });
    };

    schema.methods.historicalRestore = function (date, callback) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me),
            surrogate       = {};

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            return callback(new Error('Historical error: Invalid date.'));
        }

        HistoricalModel.find({
            document: me[primaryKeyName],
            timestamp: {$lte: date}
        }, null, {sort: {timestamp: 1}}, function (e, objs) {
            if (e) {
                return callback(e);
            }
            if (!objs) {
                return callback(null, null);
            }

            objs.forEach(function (obj) {
                surrogate = obj.diff ? _.merge(surrogate, obj.diff, arrayMerge) : null;
            });

            if (!surrogate) {
                return callback(null, null);
            }

            var meObj = {};
            _.toPairs(me.constructor.schema.paths).forEach(function (pair) {
                write(meObj, pair[0], null);
            });
            delete meObj[primaryKeyName];
            delete meObj.__v;

            me.set(_.merge(meObj, surrogate, arrayMerge));
            return callback(null, me);
        });
    };

    schema.methods.historicalTrim = function (date, callback) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            return callback(new Error('Historical error: Invalid date.'));
        }

        me.historicalRestore(date, function (e, obj) {
            if (e) {
                return callback(e);
            }
            if (!obj) {
                return callback(null, me);
            }
            HistoricalModel.remove({document: me[primaryKeyName], timestamp: {$lte: date}}, function (e) {
                if (e) {
                    return callback(e);
                }
                var trimmed = new HistoricalModel({
                    document: me[primaryKeyName],
                    diff: obj.toObject(),
                    timestamp: date
                });
                trimmed.save(function (e) {
                    return e ? callback(e) : callback(null, me);
                });
            });
        });
    };

    schema.methods.historicalDetails = function (date, callback) {
        var me              = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            return callback(new Error('Historical error: Invalid date.'));
        }

        HistoricalModel.find({
            document: me[primaryKeyName],
            timestamp: {$lte: date}
        }, null, {sort: {timestamp: 1}}, function (e, objs) {
            return e ? callback(e) : callback(null, objs);
        });
    };

    schema.methods.historical = function () {
        var me       = this,
            action   = null,
            date     = new Date(),
            callback = function () {
            },
            args     = Array.prototype.slice.call(arguments, 0, 3);

        if (_.isString(args[0])) {
            action = args[0];
        }

        if (_.isDate(args[1])) {
            date = args[1];
        }

        if (_.isFunction(args[args.length - 1])) {
            callback = args[args.length - 1];
        }

        switch (action) {
            case 'snapshot':
                me.historicalSnapshot(callback);
                break;
            case 'clear':
                me.historicalClear(callback);
                break;
            case 'restore':
                me.historicalRestore(date, callback);
                break;
            case 'trim':
                me.historicalTrim(date, callback);
                break;
            case 'history':
            case 'details':
            default:
                me.historicalDetails(date, callback);
        }
    };
};
