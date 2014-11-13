var mongoose = require('mongoose'),
    _ = require('underscore'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId,
    models = {};

_.mixin(require('underscore.deep'));

module.exports = function (schema, options) {
    options = options || {};
    var primaryKeyName;

    var getHistoricalModel = function (model) {
        var connection = options.connection || model.constructor.collection.conn,
            name = options.name || model.constructor.modelName + 's_historical';

        primaryKeyName = options.primaryKeyName || '_id';

        if (!model.constructor.schema.paths[primaryKeyName]) {
            throw new Error('Historical error: Missing primary key `' + primaryKeyName + '` in schema `' + name + '`.');
        }

        var primaryKeyType = (options.primaryKeyType || /* deprecated */ options.idType) || (model.constructor.schema.paths[primaryKeyName].options.type || ObjectId);

        models[model.constructor.modelName] = models[model.constructor.modelName] === undefined ?
            connection.model(name, new Schema({
                document: { type: primaryKeyType, index: true },
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
            document: me[primaryKeyName],
            diff: diff
        });
        historical.save(next);
    });

    schema.pre('remove', function (next) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        var historical = new HistoricalModel({
            document: me[primaryKeyName],
            diff: null
        });
        historical.save(next);
    });

    schema.methods.historicalSnapshot = function (callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (me.modifiedPaths().length) {
            return callback(new Error('Historical error: Attempted to snapshot an unsaved/modified document.'));
        }
        var historical = new HistoricalModel({
            document: me[primaryKeyName],
            diff: me.toObject()
        });
        historical.save(function (e) {
            if (e) {
                return callback(e);
            }
            return callback(null, me);
        });
    };

    schema.methods.historicalClear = function (callback) {
        var me = this,
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
        var me = this,
            HistoricalModel = getHistoricalModel(me),
            surrogate = {};

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            return callback(new Error('Historical error: Invalid date.'));
        }

        HistoricalModel.find({document: me[primaryKeyName], timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
            if (e) {
                return callback(e);
            }
            if (!objs) {
                return callback(null, null);
            }

            objs.forEach(function (obj) {
                if (!obj.diff) {
                    surrogate = null;
                }
                else {
                    surrogate = _.deepExtend(surrogate, obj.diff);
                }
            });

            if (!surrogate) {
                return callback(null, null);
            }

            var newObj = new me.constructor(surrogate);
            newObj[primaryKeyName] = me[primaryKeyName];
            return callback(null, newObj);
        });
    };

    schema.methods.historicalTrim = function (date, callback) {
        var me = this,
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
                    if (e) {
                        return callback(e);
                    }
                    return callback(null, me);
                });
            });
        });
    };

    schema.methods.historicalDetails = function (date, callback) {
        var me = this,
            HistoricalModel = getHistoricalModel(me);

        callback = _.isFunction(callback) ? callback : function () {
        };

        if (!_.isDate(date) || date.getTime() > new Date().getTime()) {
            return callback(new Error('Historical error: Invalid date.'));
        }

        HistoricalModel.find({document: me[primaryKeyName], timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
            if (e) {
                return callback(e);
            }
            return callback(null, objs);
        });
    };

    schema.methods.historical = function () {
        var me = this,
            action = null,
            date = new Date(),
            callback = function () {
            },
            args = Array.prototype.slice.call(arguments, 0, 3);

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
