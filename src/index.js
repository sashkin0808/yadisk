import React, {useEffect, useState} from 'react';
import ReactDOM from 'react-dom/client';
import './css/bootstrap.css'; 
import './css/styles.css';

const MAX_FILE_NUMBER = 100;
const CLIENT_ID = "808109afb46b43d4a2ab57464feafd0a";
const REDIRECT_URL = "http://localhost:3001/";
const AUTH_TOKEN = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}`;
// Yandex.Disc API
const API_FOLDERS = "https://cloud-api.yandex.net/v1/disk/resources?path=";
const API_UPLOAD = "https://cloud-api.yandex.net/v1/disk/resources/upload?path=";

const getDiskData = async (path, token) => {
    const FOLDER_URL = API_FOLDERS + path + "&limit=10000";
    const headers = new Headers({
        'Authorization': `OAuth ` + token
    });
    const init = {
        headers: headers
    };
    const response = await fetch(FOLDER_URL, init);
    const json = await response.json();
    return json._embedded.items;
};

const App = () => {
    const [token, setToken] = useState('');

    useEffect(() => {
        if (document.location.hash) {
            const hashToken = /access_token=([^&]+)/.exec(document.location.hash)[1];
            localStorage.setItem('token', hashToken);
            setToken(hashToken);
            document.location = document.location.origin + document.location.pathname;
            return;
        }
        const cookieToken = localStorage.getItem('token');
        if (cookieToken) {
            setToken(cookieToken);
            return;
        }
    }, []);

    return (
        <div>
            {token
                ? <YandexDisk token={token}/>
                : <Token/>
            }
        </div>
    )
};

const YandexDisk = ({token}) => {
    const [state, setState] = useState({
        folder: [''],
        files: [],
        error: ""
    });
    const [loading, setLoading] = useState('hide');

    const addResultToList = (name) => {
        if (state.files.findIndex(el => el.name === name) !== -1) {
            return;
        }
        const pos = state.files.findIndex(el => (el.name > name && el.type !== 'dir'));
        setState(state => ({
            ...state,
            files: [
                ...state.files.slice(0, pos), 
                {
                    name, 
                    new: true
                },
                ...state.files.slice(pos),  
            ]
        }));
    };

    useEffect(() => {
        const getFolder = async () => {
            setLoading('show');
            setState(state => ({...state, error: ""}));

            const path = state.folder.join('/').replace('disk:/', '') + '/';
            try {
                const result = await getDiskData(path, token);
                setState(state => ({...state, files: result}));
            } catch(err) {
                setState(state => ({...state, error: 'Oшибка получения данных'}));
            }

            setLoading('hide');
        };
        getFolder();
    }, [state.folder, token]);

    return (
        <div className="container">
            <div className="row">
                <div className="col-md-12">
                    <Preloader loading={loading}/>
                    <h2>Яндекс Диск</h2>
                    <FileUpload
                        folder={state.folder}
                        token={token}
                        setLoading={setLoading}
                        addResult={addResultToList} />
                    <table className="table table-bordered table-striped table-hover">
                        <tbody>
                            {
                                state.files.map((item) => (
                                    <tr key={item.name} className={`${item.new ? 'new' : ''}`}>
                                        {item.type === 'dir'
                                            ?   <td className="table_dir" onClick={() => setState(state => ({...state, folder: [...state.folder, item.name]}))}>{item.name}</td>
                                            :   <td className="table_file">{item.name}</td>
                                        }
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                    <h3>{state.error}</h3>
                </div>
            </div>
        </div>
    )
};

const FileUpload = ({token, folder= ['disk:', 'Temp'], addResult, setLoading}) => {
    const [btn, setBtn] = useState({
        buttonLabel: 'Выберите файлы для загрузки',
        buttonClass: 'hidden'
    });
    const [value, setValue] = useState([]);
    const [result, setResult] = useState({success: 0, error: 0, errorNames: []});
    const [key, setKey] = useState(Math.random().toString(36));
    
    const uploadFile = async (url, formData, fileName) => {
        const requestOptions = {
            method: 'PUT',
            body: formData
        };
        const res = await fetch(url, requestOptions);
        if (res.status === 201) {
            setResult(state => ({
                ...state, 
                success: state.success + 1
            }));
            addResult(fileName);
        } else {
            setResult(state => ({
                ...state, 
                error: state.error + 1,
                errorNames: [...state.errorNames, fileName]
            }));
        }
    };

    const startUpload = async (event) => {
        event.preventDefault();
        const headers = new Headers({
            'Authorization': 'OAuth ' + token,
            'Content-Type': 'application/json'
        });
        const init = {
            method: 'GET',
            headers: headers
        };
        setLoading('show');
        await Promise.all(Array.from(value).map(async file => {
            const formData = new FormData();
            formData.append('file', file);
            const filePath = folder.join('/') + '/';
            const url = API_UPLOAD + filePath + file.name + '&overwrite=true';
            
            const response = await fetch(url, init);
            const json = await response.json();
            await uploadFile(json.href, formData, file.name);    
        }));
        setValue([]);
        setKey(Math.random().toString(36));
        setBtn({
            buttonLabel: 'Выберите файлы для загрузки', 
            buttonClass: 'hidden'
        });
        setLoading('hide');
    };
    const fileInputChange = (event) => {
        if (event.target.files.length > MAX_FILE_NUMBER) {
            alert(`Максимальное количество файлов для загрузки: ${MAX_FILE_NUMBER}`);
            return;
        }
        const buttonText = (event.target.files.length > 0)
            ? `Файл: `
            : `Выберите файл для загрузки`;
        setBtn({
            buttonLabel: buttonText, 
            buttonClass: ''
        });
        setValue(event.target.files);
    };

    return (
        <div>
            <form
                id="sentfile"
                name="uploadfile"
                className="file-load"
                onSubmit={startUpload}>
                <label htmlFor="fileinput" className="btn btn-link text-uppercase file-load__title">
                    {btn.buttonLabel}
                    {value.length > 0 
                        ?   Array.from(value).map((el, i) => <span key={i}>{el.name}</span>)
                        :   ''
                    }
                </label>
                <input
                    name="file"
                    type="file"
                    id="fileinput"
                    key={key}
                    className="hidden"
                    multiple="multiple"
                    onChange={fileInputChange}/>
                <button className={'btn btn-primary text-uppercase ' + btn.buttonClass}>ЗАГРУЗИТЬ</button> 
            </form>
            <p className="load-result">
                Загружено файлов успешно: {result.success}
                {result.error > 0 && <>
                    <br/>Ошибок загрузки: {result.error}
                    <br/>Не загружены следующие файлы: 
                    {result.errorNames.map((el, i) => <span key={i}>{el}</span>)}
                </> }
            </p>
        </div>
    );
};

const Preloader = (props) => {
    return <div id="floatingCirclesG" className={props.loading}>
        <div className="f_circleG" id="frotateG_01"></div>
        <div className="f_circleG" id="frotateG_02"></div>
        <div className="f_circleG" id="frotateG_03"></div>
        <div className="f_circleG" id="frotateG_04"></div>
        <div className="f_circleG" id="frotateG_05"></div>
        <div className="f_circleG" id="frotateG_06"></div>
        <div className="f_circleG" id="frotateG_07"></div>
        <div className="f_circleG" id="frotateG_08"></div>
    </div>
};

const Token = () => {
    return (
        <div className="container">
            <div className="row">
                <div className="col-md-12">
                    <h2>Яндекс Диск</h2>
                    <div className="jumbotron">
                        <p>Для доступа к своему разделу на Яндекс.Диск
                            нажмите кнопку "Получить доступ к диску".<br/>
                            Затем подтвердите доступ для приложения на странице Яндекс.
                        </p>
                        <a
                            className="btn btn-success btn-lg"
                            href={AUTH_TOKEN}
                            >Получить доступ к диску</a>
                    </div>
                </div>
            </div>
        </div>
    )
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
