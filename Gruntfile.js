module.exports = function(grunt) {

    var config = grunt.file.readJSON('screeps.json');

    var branch = grunt.option('branch') || 'default';

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: config.email,
                token: config.token,
                branch: branch
            },
            dist: {
                files: [
                    {src: ['./*.js']}
                ]
            }
        }
    });

    grunt.registerTask('default', ['screeps']);
};
