// ==UserScript==
// @name         Steam: IGDB game info
// @description  Add time to beat info and game ratings form IGDB to Steam store pages.
// @author       Xeloses
// @version      1.0
// @license      MIT
// @namespace    Xeloses.Steam.IGDB
// @match        https://store.steampowered.com/app/*
// @updateURL    https://github.com/Xeloses/steam-igdb-info/raw/master/steam-igdb-info.user.js
// @downloadURL  https://github.com/Xeloses/steam-igdb-info/raw/master/steam-igdb-info.user.js
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlhttpRequest
// @grant        GM_xmlhttpRequest
// @connect      api-v3.igdb.com
// @noframes
// @run-at       document-end
// ==/UserScript==

(function(){
    'use strict';

    // IGDB API endpoint:
    const IGDB_API_URL = 'https://api-v3.igdb.com/games';

    // IGDB API key:
    let IGDB_API_KEY = null;

    // Game name:
    let GAME_NAME = null;

    // Enable/disable status & error output to console:
    const ENABLE_CONSOLE_OUTPUT = true;

    // Console message types:
    const LOG_INFO = 1;
    const LOG_WARN = 2;
    const LOG_ERROR = 3;

    // prevent script execution in <frame>s:
    if(window.self!=window.top){
        return;
    }

    function $log(msg,level=null){
        if(!ENABLE_CONSOLE_OUTPUT||!msg){return;}

        let t = '%c[Xeloses` IGDB plugin]%c '+msg,
            hStyle = 'color:#c5c;font-weight:bold;',
            tStyle = 'color:#ddd;font-weight:normal;';

        switch(level){
            case LOG_INFO:
                console.info(t,hStyle,tStyle+'font-style:italic;');break;
            case LOG_WARN:
                console.warn(t,hStyle,tStyle);break;
            case LOG_ERROR:
                console.error(t,hStyle,tStyle);break;
            default:
                console.log(t,hStyle,tStyle);break;
        }
    }

    function renderApiKeyForm(){
        // form HTML:
        let igdbKeyForm = '<div id="igdb_api_key_form_container"><div class="block responsive_apppage_details_right heading">IGDB game info</div><div class="block responsive_apppage_details_left game_details"><div class="block_content"><div class="block_content_inner"><div class="details_block"><form id="igdb_api_key_form"><div class="dev_row">API key is required to retrieve data from IGDB.</div><div class="dev_row">Get your API key here: <a rel="noopener noreferrer" target="_blank" title="API.IGDB.COM (open in new tab)" href="https://api.igdb.com/admin">api.igdb.com</a></div><div class="dev_row"><b>IGDB API KEY:</b></div><div class="dev_row"><input type="text" name="igdb_api_key" id="igdb_api_key" size="20" maxlength="32" minlength="32" placeholder="Paste your API key here" style="height:15px;margin-right:5px;padding:6px 4px;font-family:Monospace;font-size:14px;" /><a href="javascript:;" id="igdb_api_key_btn" class="btnv6_green_white_innerfade btn_medium"><span>Save</span></a></div><div class="dev_row" id="igdb_api_key_error" style="display:none;color:#d33;font-style:italic"></div></form></div></div></div></div></div>';
        // insert form into page:
        $J('.page_content>.rightcol.game_meta_data').prepend($J(igdbKeyForm));

        // get <form> element:
        let $frm = $J('form#igdb_api_key_form');

        // add <form> submit event listener:
        $frm.on('submit',(e)=>{
            e.preventDefault();
            e.stopPropagation();
            // get API key value from <input> element:
            IGDB_API_KEY = $frm.find('input#igdb_api_key').val().trim();
            // check API key:
            if(IGDB_API_KEY && /^[a-f0-9]{32}$/.test(IGDB_API_KEY)){
                // store API key:
                GM.setValue('IGDB_API_KEY',IGDB_API_KEY).then(()=>{
                    // [SUCCESS] remove form from page:
                    $J('#igdb_api_key_form_container').remove();
                    // get game info from IGDB:
                    fetchGameInfo();
                }).catch(()=>{
                    // [FAIL] hide form content:
                    $frm.find('.dev_row').css('display','none');
                    // show error message:
                    $frm.find('#igdb_api_key_error').css('display','block').text('Error attempt to save API key.');
                });
            }else{
                // show error message:
                $frm.find('#igdb_api_key_error').css('display','block').text('Please, enter a valid IGDB API key.');
            }
            // prevent form submit:
            return false;
        });

        // add "Save" button event listener:
        $frm.find('#igdb_api_key_btn').on('click',()=>{
            $frm.submit();
        });
    }

    function renderGameInfo(data){
        if(data.aggregated_rating || data.rating || data.time_to_beat){
            // compile HTML with game info:
            let igdbData = '<div><div class="block responsive_apppage_details_right heading">' + (data.url?'<a rel="noopener noreferrer" target="_blank" title="View more information on IGDB" href="' + data.url + '">IGDB</a>':'IGDB') + ' game info</div></div>';
            igdbData += '<div class="block responsive_apppage_details_left game_details"><div class="block_content"><div class="block_content_inner"><div class="details_block">';
            igdbData += data.aggregated_rating?'<div class="dev_row"><b>Critics rating:</b> ' + data.aggregated_rating.toFixed(2) + '</div>':'';
            igdbData += data.rating?'<div class="dev_row"><b>Players rating:</b> ' + data.rating.toFixed(2) + '</div>':'';
            if(data.time_to_beat){
                igdbData += data.time_to_beat.normally?'<div class="dev_row"><b>Normal playthgough:</b> ' + (data.time_to_beat.normally/3600).toFixed(1) + ' h.</div>':'';
                igdbData += data.time_to_beat.completely?'<div class="dev_row"><b>Completionist:</b> ' + (data.time_to_beat.completely/3600).toFixed(1) + ' h.</div>':'';
                igdbData += data.time_to_beat.hastly?'<div class="dev_row"><b>Speed run:</b> ' + (data.time_to_beat.hastly/3600).toFixed(1) + ' h.</div>':'';
            }
            igdbData += '</div></div></div></div>';

            // insert game info into page:
            $J('.page_content>.rightcol.game_meta_data').prepend($J(igdbData));
        }
    }

    function fetchGameInfo(){
        // get proper xmlHTTPrequest:
        let $xhr = (typeof GM.xmlhttpRequest !== 'undefined')?GM.xmlhttpRequest:GM_xmlhttpRequest;
        // query info about game:
        $xhr({
            method:'POST',
            url: IGDB_API_URL,
            headers:{
                'Accept':'application/json',
                'user-key':IGDB_API_KEY
            },
            data:'search "' + GAME_NAME + '"; fields name,url,aggregated_rating,rating,time_to_beat.*;',
            onload:function(response){
                // check responce status:
                if(response.status && response.status == 200){
                    // check responce data:
                    if(response.response && response.response.length){
                        // clear game name for comparsion:
                        let g_name = GAME_NAME.toLocaleLowerCase().replace(/[^\w\d\s]/gi,'');
                        // filted data:
                        let data = JSON.parse(response.response).filter((item)=>{
                            return (typeof item === 'object' && item.name && item.name.toLocaleLowerCase().replace(/[^\w\d\s]/gi,'') == g_name);
                        });
                        // check filtered data:
                        if(data.length){
                            $log('Data Loaded.',LOG_INFO);
                            // add game info to page:
                            renderGameInfo(data[0]);
                        }else{
                            $log('Game does not have entry in IGDB.',LOG_WARN);
                        }
                    }else{
                        $log('Error: no data recieved from IGDB.',LOG_ERROR);
                    }
                }else{
                    $log('Error' + (response.status?'('+response.status+')':'') + ': could not retrieve data from IGDB.',LOG_ERROR);
                }
            },
            onerror:function(response){
                $log(APP_NAME + 'Error: request error.',LOG_ERROR);
            },
        });
    }

    // check URL:
    if(/https:\/\/store\.steampowered\.com\/app\/[\d]{2,}[\/]?[\S]*/i.test(window.location.href)){

        // check Steam's jQuery object:
        if(typeof $J !== 'function'){
            return;
        }

        // get currently viewed game name:
        GAME_NAME = $J('.page_title_area .apphub_AppName').text().trim();

        // check IGDB API key:
        GM.getValue('IGDB_API_KEY',null).then((val)=>{
            IGDB_API_KEY = (val && /^[a-f0-9]{32}$/.test(val))?val:null;
            if(IGDB_API_KEY){
                fetchGameInfo();
            }else{
                renderApiKeyForm();
            }
        }).catch(()=>{
            //console.error(APP_NAME + 'Error attempt to get key from storage.');
        });
    }
})();
