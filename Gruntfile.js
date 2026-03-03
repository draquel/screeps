module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: 'draquel@webjynx.com',
                token: 'TOKEN',
                branch: 'default',
                //branch: 'dev',
                //server: 'season'
            },
            dist: {
                files: [
                    {src: ['./*.js']}
                ]
            },
        }
    });
}
