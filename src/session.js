/**
 *
 * @author     chenjp
 * @copyright  Copyright (c) 2017 - <chenjp(at)yunheit.com>
 * @license    MIT
 * @version    6/8/17
 */
const lib = require('think_lib');
const crypto = require('crypto');

module.exports = class {
    constructor(options = {}) {
        this.options = lib.extend({
            session_path: '', //file类型下文件存储位置
            session_name: 'thinkkoa', //session对应的cookie名称
            session_key_prefix: 'Session:', //session名称前缀
            session_options: {}, //session对应的cookie选项
            session_sign: '', //session对应的cookie使用签名
            session_timeout: 24 * 3600, //服务器上session失效时间，单位：秒
        }, options);
    }

    /**
     * 
     * 
     * @param {any} ctx 
     * @param {any} name 
     * @param {any} value 
     * @param {any} timeout 
     * @returns 
     */
    async set(ctx, name, value, timeout) {
        try {
            let instance = this.getInstance(ctx);
            let content = {
                [name]: value,
                expire: timeout ? Date.now() + timeout * 1000 : null,
                timeout: timeout || -1
            };
            let data = await instance.get(instance.options.session_key);
            if (!lib.isEmpty(data)) {
                data = JSON.parse(data);
                data = lib.extend(data, content);
            } else {
                data = content;
            }
            return instance.set(instance.options.session_key, JSON.stringify(data), timeout);
        } catch (e) {
            return Promise.resolve();
        }
    }

    /**
     * 
     * 
     * @param {any} ctx 
     * @param {any} name 
     * @returns 
     */
    async get(ctx, name) {
        try {
            let instance = this.getInstance(ctx);
            let data = await instance.get(instance.options.session_key);
            data = JSON.parse(data);
            if (data.expire && Date.now() > data.expire) {
                instance.rm(instance.options.session_key);
                return '';
            } else {
                return data[name];
            }
        } catch (e) {
            return Promise.resolve();
        }
    }

    /**
     * 
     * 
     * @param {any} ctx 
     * @param {any} name 
     * @returns 
     */
    rm(ctx, name) {
        try {
            if (name) {
                return this.set(ctx, name, null);
            }
            let instance = this.getInstance(ctx);
            return instance.rm(instance.options.session_key);
        } catch (e) {
            return Promise.resolve();
        }
    }

    /**
     * 
     * 
     * @param {any} ctx 
     * @returns 
     */
    getInstance(ctx) {
        if (ctx._session) {
            return ctx._session;
        }
        //validate cookie sign
        let sessionName = this.options.session_name;
        let sessionSign = this.options.session_sign;

        let cookie = ctx.cookie(sessionName);
        if (cookie && sessionSign) {
            cookie = this.cookieUnsign(cookie, sessionSign);
        }

        //generate session cookie when cookie is not set
        if (!cookie) {
            cookie = this.cookieUid(32);
            //sign cookie
            if (sessionSign) {
                cookie = this.cookieSign(cookie, sessionSign);
            }
            ctx.cookie(sessionName, cookie, { length: 32, httponly: true });
        }

        const handle = this.options.handle || think._stores || null;
        if (!handle) {
            ctx.throw(500, 'Session stores initialize faild.');
        }
        let cacheOptions = {
            cache_path: this.options.session_path || __dirname,
            cache_key_prefix: this.options.session_key_prefix || 'Session:',
            cache_timeout: this.options.session_timeout || 24 * 3600,
            session_key: cookie
        };
        ctx._session = new handle(cacheOptions);
        return ctx._session;
    }

    /**
     * 生成cookie签名
     * @param val
     * @param secret
     * @returns {string}
     */
    cookieSign(val, secret = '') {
        secret = crypto.createHmac('sha256', secret).update(val).digest('base64');
        secret = secret.replace(/\=+$/, '');
        return val + '.' + secret;
    }

    /**
     * 解析cookie签名
     * @param val
     * @param secret
     * @returns {*}
     */
    cookieUnsign(val, secret) {
        let str = val.slice(0, val.lastIndexOf('.'));
        return this.cookieSign(str, secret) === val ? str : '';
    }

    /**
     * 生成uid
     * @param length
     * @returns {string}
     */
    cookieUid(length) {
        let str = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64').slice(0, length);
        return str.replace(/[\+\/]/g, '_');
    }
};