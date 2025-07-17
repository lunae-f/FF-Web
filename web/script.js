// ffmpeg.wasmから必要な機能をインポート
const { createFFmpeg, fetchFile } = FFmpeg;

// FFmpegインスタンスを生成
const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
});

// HTML要素を取得
const uploader = document.getElementById('uploader');
const transcodeButton = document.getElementById('transcodeButton');
const statusP = document.getElementById('status');
const resultDiv = document.getElementById('result');
const formatSelector = document.getElementById('formatSelector');
const container = document.querySelector('.container'); // ▼ 追加

let selectedFile = null;

/**
 * ファイルが選択されたときの共通処理
 * @param {File} file 選択またはドロップされたファイル
 */
const handleFileSelect = (file) => {
    if (!file) {
        return;
    }
    selectedFile = file;
    transcodeButton.disabled = false;
    statusP.textContent = `ファイルを選択しました: ${selectedFile.name}`;
    resultDiv.innerHTML = '';
};

/**
 * メインの変換処理
 */
const transcode = async () => {
    if (!selectedFile) {
        alert('ファイルが選択されていません。');
        return;
    }

    transcodeButton.disabled = true;
    resultDiv.innerHTML = '';

    // ▼ 選択された出力フォーマット（拡張子）を取得
    const outputExtension = formatSelector.value;
    
    // ▼ 元のファイル名から拡張子を除いた部分を取得
    const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
    
    // ▼ 新しい出力ファイル名を生成
    const outputFilename = `${baseName}.${outputExtension}`;

    try {
        if (!ffmpeg.isLoaded()) {
            statusP.textContent = 'エンコーダーをロード中... (初回は時間がかかります)';
            await ffmpeg.load();
        }

        statusP.textContent = 'ファイルを準備中...';
        ffmpeg.FS('writeFile', selectedFile.name, await fetchFile(selectedFile));

        ffmpeg.setProgress(({ ratio }) => {
            statusP.textContent = `変換中... ${Math.round(ratio * 100)}%`;
            if (ratio < 0) {
                statusP.textContent = '最終処理中...';
            }
        });

        // FFmpegコマンドを実行
        await ffmpeg.run('-i', selectedFile.name, outputFilename);

        statusP.textContent = 'ファイル読み出し中...';
        const data = ffmpeg.FS('readFile', outputFilename);

        // MIMEタイプを拡張子に応じてマッピング
        const mimeTypeMap = {
            mp3: 'audio/mpeg',
            m4a: 'audio/mp4',
            flac: 'audio/flac',
            wav: 'audio/wav',
            opus: 'audio/opus',
        };
        const outputMimeType = mimeTypeMap[outputExtension] || 'application/octet-stream';
        
        // ダウンロード用のリンクを生成
        const audioBlob = new Blob([data.buffer], { type: outputMimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        const anchor = document.createElement('a');
        anchor.href = audioUrl;
        anchor.download = outputFilename; // ファイル名も動的に
        anchor.textContent = `${outputFilename} をダウンロード`;
        resultDiv.appendChild(anchor);

        statusP.textContent = '変換が完了しました！';

    } catch (error) {
        console.error(error);
        statusP.textContent = `エラーが発生しました。コンソールを確認してください。`;
    } finally {
        transcodeButton.disabled = false;
    }
};

// ファイル選択ボタンのイベント
uploader.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
});

// 変換ボタンのイベント
transcodeButton.addEventListener('click', transcode);

// ▼ ここからドラッグ＆ドロップのイベント処理を追加 ▼

// デフォルトの動作を無効化
container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.classList.add('dragover');
});

// ドロップエリアから離れたときの処理
container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove('dragover');
});

// ファイルがドロップされたときの処理
container.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    container.classList.remove('dragover');

    // 複数ファイルがドロップされても最初の1つだけを対象にする
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
});