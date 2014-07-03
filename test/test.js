var mongoose = require('mongoose'),
    TestSchema = new mongoose.Schema({
        testString: String,
        testNumber: Number,
        testArray: [String],
        testBoolean: Boolean,
        testObject: {
            testObjectElement: String
        }
    });
TestSchema.plugin(require('../historical.js'));

module.exports = {
    'testNewDocument': function (beforeExit, assert) {
        var connection = mongoose.createConnection('mongodb://localhost/historical_test'),
            TestModel = connection.model('test', TestSchema);

        var test = this,
            document = new TestModel({
                testString: 'test',
                testNumber: 42,
                testArray: ['test1', 'test2'],
                testBoolean: true,
                testObject: {
                    testObjectElement: 'test message'
                }
            });

        document.save(function (e, obj) {
            assert.isNull(e);
            assert.isDefined(obj);

            obj.historical('details', function (e, details) {
                assert.isNull(e);
                assert.type(details, 'object');
                assert.equal(1, details.length);

                obj._id = undefined;
                obj.__v = undefined;

                assert.eql(obj.toObject(), details[0].diff);

                connection.close();
            });
        });
    }
};