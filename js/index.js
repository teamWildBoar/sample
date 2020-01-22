const stopButton = document.getElementById('stopButton');
const startButton = document.getElementById('startButton');

// audio data
let bufferSize = 1024;

/**
 * API呼び出し
 * @param {String} base64str 音声のbase64文字列
 */
const callApi = (base64str, audio_sample_rate) => {
    const jsonData = {
        'audio_data': base64str,
        'encoding': 'LINEAR16',
        'sample_rate_hertz': String(audio_sample_rate),
        'language_code': 'ja-JP'
    };
    const url = 'https://emqn91911k.execute-api.ap-northeast-1.amazonaws.com/prod/createMinutes';
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'tyTk0TgbK0avd6LWjQRLuVqoKveElRe3WsuSjnx6'
        },
        body: JSON.stringify(jsonData),
        cache: 'no-cache'
    }).then(
        res => res.ok ? res.json() : Promise.reject(res.json())
    ).then(
        data => {
            // Success
            let i = 0;
            const len = data.results.length;
            let str = '';
            //FIXME APIレスポンスより話者を取得し設定
            while (i < len) {
                str += `${$('#messageId').val()}\n${data.results[i++].alternatives[0].transcript}\n`
                $('#messageId').val(str);
            }
        },
        error => {
            // Error
            alert('error');
            console.log(`error: ${JSON.stringify(error)}`);
        }
    );
};

let saveAudio = (audioContext, audioData, audio_sample_rate) => {
    exportWAV(audioData, audio_sample_rate);
    audioContext.close().then(() => {
        audioData = [];
    });
}

// export WAV from audio float data
let exportWAV = (audioData, audio_sample_rate) => {

    let encodeWAV = (samples, sampleRate) => {
        let buffer = new ArrayBuffer(44 + samples.length * 2);
        let view = new DataView(buffer);

        let writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        let floatTo16BitPCM = (output, offset, input) => {
            for (let i = 0; i < input.length; i++ , offset += 2) {
                let s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        writeString(view, 0, 'RIFF');  // RIFFヘッダ
        view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
        writeString(view, 8, 'WAVE'); // WAVEヘッダ
        writeString(view, 12, 'fmt '); // fmtチャンク
        view.setUint32(16, 16, true); // fmtチャンクのバイト数
        view.setUint16(20, 1, true); // フォーマットID
        view.setUint16(22, 1, true); // チャンネル数
        view.setUint32(24, sampleRate, true); // サンプリングレート
        view.setUint32(28, sampleRate * 2, true); // データ速度
        view.setUint16(32, 2, true); // ブロックサイズ
        view.setUint16(34, 16, true); // サンプルあたりのビット数
        writeString(view, 36, 'data'); // dataチャンク
        view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
        floatTo16BitPCM(view, 44, samples); // 波形データ

        return view;
    };

    let mergeBuffers = audioData => {
        let sampleLength = 0;
        for (let i = 0; i < audioData.length; i++) {
            sampleLength += audioData[i].length;
        }
        let samples = new Float32Array(sampleLength);
        let sampleIdx = 0;
        for (let i = 0; i < audioData.length; i++) {
            for (let j = 0; j < audioData[i].length; j++) {
                samples[sampleIdx] = audioData[i][j];
                sampleIdx++;
            }
        }
        return samples;
    };

    let dataview = encodeWAV(mergeBuffers(audioData), audio_sample_rate);
    let audioBlob = new Blob([dataview], { type: 'audio/wav' });

    const reader = new FileReader();
    reader.onload = e => {
        const dataUrl = reader.result;
        const base64str = dataUrl.substr(dataUrl.indexOf(',') + 1);
        callApi(base64str, audio_sample_rate);
    };
    reader.readAsDataURL(audioBlob);

    let myURL = window.URL || window.webkitURL;
    let url = myURL.createObjectURL(audioBlob);
    return url;
};

// save audio data

// getusermedia
const handleSuccess = stream => {
    const audioContext = new AudioContext();
    const audio_sample_rate = audioContext.sampleRate;
    console.log(audio_sample_rate);
    let audioData = [];
    const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    const mediastreamsource = audioContext.createMediaStreamSource(stream);
    mediastreamsource.connect(scriptProcessor);
    const onAudioProcess = e => {
        var input = e.inputBuffer.getChannelData(0);
        var bufferData = new Float32Array(bufferSize);
        for (var i = 0; i < bufferSize; i++) {
            bufferData[i] = input[i];
        }

        audioData.push(bufferData);
    };
    scriptProcessor.onaudioprocess = onAudioProcess;
    scriptProcessor.connect(audioContext.destination);

    // when time passed without pushing the stop button
    setTimeout(() => {
        console.log("10 sec");
        saveAudio(audioContext, audioData, audio_sample_rate);
    }, 10000);
};

let interval_num;

const handler = () => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(handleSuccess);
}

startButton.addEventListener('click', () => {
    handler();
    // getUserMedia
    interval_num = setInterval(handler, 10000);

})

// stop button
stopButton.addEventListener('click', () => {
    clearInterval(interval_num);
    console.log(`clear interval`);
});
