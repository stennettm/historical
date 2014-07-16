var mongoose = require('mongoose'),
    _ = require('underscore'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId,
    models = [];

_.mixin(require('underscore.deep'));

module.exports = function (schema, options) {
    options = options || {};

    var getHistoricalModel = function (model) {
        var connection = options.connection || model.constructor.collection.conn,
            name = options.name || model.constructor.modelName + 's_historical';

        models[model.constructor.modelName] = models[model.constructor.modelName] === undefined ?
            connection.model(name, new Schema({
                document: { type: model.constructor.schema.paths._id.options.type || ObjectId, index: true },
                timestamp: {type: Date, default: Date.now, index: true},
                diff: Schema.Types.Mixed
            })) : models[model.constructor.modelName];

        return models[model.constructor.modelName];
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
                o = o[n];
            }
        }
        o[a[a.length - 1]] = v;
    };

    schema.pre('save', function (next) {
        var me = this,
            HistoricalModel = getHistoricalModel(me),
            modified = _.uniq(this.modifiedPaths()),
            diff = {};

        modified.forEach(function (index) {
            var value = read(me, index);
            if (_.isObject(value) && !_.isArray(value)) {
                return;
            }
            if (value === undefined) {
                write(diff, index, null);
                return;
            }
            write(diff, index, value);
        });

        var historical = new HistoricalModel({
            document: me.id,
            diff: diff
        });
        historical.save(next);
    });

    schema.pre('remove', function (next) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        var historical = new HistoricalModel({
            document: me.id,
            diff: null
        });
        historical.save(next);
    });

    schema.methods.historicalSnapshot = function (callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        if (me.modifiedPaths().length) {
            callback(new Error('Historical error: Attempted to snapshot an unsaved/modified document.'));
            return;
        }
        var historical = new HistoricalModel({
            document: me.id,
            diff: me.toObject()
        });
        historical.save(function (e) {
            if (e) {
                if (_.isFunction(callback)) {
                    callback(e);
                }
                return;
            }
            if (_.isFunction(callback)) {
                callback(null, me);
            }
        });
    };

    schema.methods.historicalClear = function (callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        HistoricalModel.find({document: me.id}, function (e, objs) {
            if (e) {
                if (_.isFunction(callback)) {
                    callback(e);
                }
                return;
            }
            me.historicalSnapshot(function (e) {
                if (e) {
                    if (_.isFunction(callback)) {
                        callback(e);
                    }
                    return;
                }
                objs.forEach(function (obj) {
                    obj.remove();
                });
                if (_.isFunction(callback)) {
                    callback(null, me);
                }
            });
        });
    };

    schema.methods.historicalRestore = function (date, callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me),
            surrogate = {};

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            if (_.isFunction(callback)) {
                callback(new Error('Historical error: Invalid date.'));
            }
            return;
        }

        HistoricalModel.find({document: me.id, timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
            if (e) {
                if (_.isFunction(callback)) {
                    callback(e);
                }
                return;
            }
            if (!objs) {
                if (_.isFunction(callback)) {
                    callback(null, null);
                }
                return;
            }

            objs.forEach(function (obj) {
                if(!obj.diff){
                    surrogate = null;
                }
                else {
                    surrogate = _.deepExtend(surrogate, obj.diff);
                }
            });

            if(!surrogate){
                callback(null, null);
                return;
            }

            var newObj = new me.constructor(surrogate);
            newObj.id = me.id;
            if (_.isFunction(callback)) {
                callback(null, newObj);
            }
        });
    };

    schema.methods.historicalTrim = function (date, callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            if (_.isFunction(callback)) {
                callback(new Error('Historical error: Invalid date.'));
            }
            return;
        }

        me.historicalRestore(date, function (e, obj) {
            if (e) {
                if (_.isFunction(callback)) {
                    callback(e);
                }
                return;
            }
            if (!obj) {
                if (_.isFunction(callback)) {
                    callback(null, me);
                }
                return;
            }
            HistoricalModel.remove({document: me.id, timestamp: {$lte: date}}, function (e) {
                if (e) {
                    if (_.isFunction(callback)) {
                        callback(e);
                    }
                    return;
                }
                var trimmed = new HistoricalModel({
                    document: me.id,
                    diff: obj.toObject(),
                    timestamp: date
                });
                trimmed.save(function (e) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (_.isFunction(callback)) {
                        callback(null, me);
                    }
                });
            });
        });
    };

    schema.methods.historicalDetails = function (date, callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            if (_.isFunction(callback)) {
                callback(new Error('Historical error: Invalid date.'));
            }
            return;
        }

        HistoricalModel.find({document: me.id, timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
            if (e) {
                callback(e);
                return;
            }
            if (_.isFunction(callback)) {
                callback(null, objs);
            }
        });
    };

    schema.methods.historical = function () {
        var me = this,
            action = null,
            date = new Date(),
            callback = function () {
            },
            args = Array.prototype.slice.call(arguments, 0, 3);

        if (typeof args[0] == 'string') {
            action = args[0];
        }

        if (_.isDate(args[1])) {
            date = args[1];
        }

        if (typeof args[args.length - 1] == 'function') {
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
