(function() {

    var mongoose = require('mongoose'),
        _ = require('underscore'),
        Schema = mongoose.Schema,
        ObjectId = Schema.Types.ObjectId,
        models = [];

    module.exports = function(schema, options) {
        options = options || {};

        var getHistoricalModel = function (model) {
            var connection = options.connection || model.constructor.collection.conn,
                name = options.name || model.constructor.modelName + 's_historical';

            models[model.constructor.modelName] = models[model.constructor.modelName] === undefined ?
                connection.model(name, new Schema({
                    document: { type: ObjectId, index: true },
                    timestamp: {type: Date, default: Date.now, index: true},
                    diff: Schema.Types.Mixed
                })) : models[model.constructor.modelName];

            return models[model.constructor.modelName];
        };
        schema.pre('save', function (next) {
            var me = this,
                HistoricalModel = getHistoricalModel(me),
                modified = this.modifiedPaths(),
                diff = _.pick(me.toObject(), modified);

            modified.forEach(function (index) {
                if (diff[index] === undefined)
                    diff[index] = null;
            });

            var historical = new HistoricalModel({
                document: me.id,
                diff: diff
            });
            historical.save(next);
        });

        schema.methods.historical = function (date, callback) {
            var me = this,
                HistoricalModel = getHistoricalModel(me),
                surrogate = {};

            HistoricalModel.find({timestamp: {$lte: date}, document: me.id}, function (e, objs) {
                if (!objs) {
                    if (callback)
                        callback(new Error("No history found."));
                    return;
                }
                if (e) {
                    if (callback)
                        callback(e);
                    return;
                }

                objs.forEach(function (obj) {
                    surrogate = _.extend(surrogate, obj.diff);
                });

                var newObj = new me.constructor(surrogate);
                newObj.id = me.id;

                callback(undefined, newObj);
            });
        };
    }

}).call(this);