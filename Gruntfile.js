module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: 'draquel@webjynx.com',
                token: '64d10b80-7b20-4a11-83b5-fbc8dfb78b1d',
                branch: 'default',
                //server: 'season'
            },
            dist: {
                src: ['./*.js']
            }
        }
    });
}
