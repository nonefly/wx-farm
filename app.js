const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const protobuf = require('protobufjs');

const CONFIG = {
    port: process.env.PORT || 3001,
    historyDir: path.join(__dirname, 'history'),
    historyLimit: 100
};

// 确保历史目录存在
if (!fs.existsSync(CONFIG.historyDir)) {
    fs.mkdirSync(CONFIG.historyDir, { recursive: true });
}

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let protoRoot = null;
let plantConfig = null;

// 变异作物数据
const MUTATION_CROPS = [
    { name: '银杏树苗', icon: '🌲', rarity: 2, rarityLabel: '稀有', baseExp: 720, baseFruit: 24, sellPrice: 240, probability: '10%', size: '1×1' },
    { name: '蝴蝶兰', icon: '🦋', rarity: 2, rarityLabel: '稀有', baseExp: 720, baseFruit: 24, sellPrice: 240, probability: '10%', size: '1×1' },
    { name: '风信子', icon: '💜', rarity: 2, rarityLabel: '稀有', baseExp: 720, baseFruit: 24, sellPrice: 240, probability: '10%', size: '1×1' },
    { name: '蔷薇', icon: '🌹', rarity: 2, rarityLabel: '稀有', baseExp: 720, baseFruit: 24, sellPrice: 240, probability: '10%', size: '1×1' },
    { name: '四叶草', icon: '🍀', rarity: 3, rarityLabel: '珍贵', baseExp: 1200, baseFruit: 40, sellPrice: 400, probability: '5%', size: '1×1' },
    { name: '钻石玫瑰', icon: '💎', rarity: 4, rarityLabel: '史诗', baseExp: 2400, baseFruit: 80, sellPrice: 800, probability: '2%', size: '1×1' },
    { name: '爱心果', icon: '❤️', rarity: 5, rarityLabel: '传说', baseExp: 4800, baseFruit: 120, sellPrice: 1200, probability: '0.5%', size: '2×2' },
];

// 格子效果类型
const GRID_EFFECTS = [
    { name: '黄金', icon: '✨', description: '产出黄金果实（稀有作物）', multiplier: '稀有产出', color: 'gold' },
    { name: '冰冻', icon: '❄️', description: '售价×3', multiplier: '×3', color: 'blue' },
    { name: '爱心', icon: '❤️', description: '产量×3', multiplier: '×3', color: 'red' },
    { name: '暗化', icon: '🌑', description: '售价×2', multiplier: '×2', color: 'dark' },
    { name: '湿润', icon: '💧', description: '产量×2', multiplier: '×2', color: 'cyan' },
];

// 天气系统
const WEATHER_TYPES = [
    { id: 0, name: '晴天', icon: '☀️' },
    { id: 1, name: '多云', icon: '☁️' },
    { id: 2, name: '下雨', icon: '🌧️' },
    { id: 3, name: '刮风', icon: '🌬️' },
    { id: 4, name: '雷电', icon: '⚡' },
    { id: 5, name: '下雪', icon: '❄️' },
];

// 多格土地
const MULTI_LANDS = [
    { size: '2×2', name: '四方福地', description: '覆盖4块地，根据覆盖地块等级计算加成', crop: '爱心果', cropColor: '#9333ea' },
    { size: '3×3', name: '九宫良田', description: '覆盖9块地，根据覆盖地块等级计算加成', crop: null },
    { size: '4×4', name: '阡陌沃土', description: '覆盖16块地，根据覆盖地块等级计算加成', crop: null },
];

// 计算等级加成
function calculateLevelBonus(level) {
    if (level <= 1) return 0;
    if (level > 100) {
        const effectiveLevel = Math.min(100 + (level - 100) * 0.5, 120);
        return Math.min(0.3, (effectiveLevel - 1) * 0.0025);
    }
    return Math.min(0.3, (level - 1) * 0.0025);
}

// 计算变异收益
function calculateMutationProfit(cropName, level) {
    const crop = MUTATION_CROPS.find(c => c.name === cropName);
    if (!crop) return null;

    const levelBonus = calculateLevelBonus(level);
    const bonusPercent = Math.round(levelBonus * 100);
    const expectedFruit = Math.round(crop.baseFruit * (1 + levelBonus));
    const expectedExp = Math.round(crop.baseExp * (1 + levelBonus));
    const expectedIncome = expectedFruit * crop.sellPrice;

    return {
        crop,
        level,
        levelBonus,
        bonusPercent,
        expectedFruit,
        expectedExp,
        expectedIncome,
        seasons: crop.name === '爱心果' ? 1 : 2,
        totalIncome: expectedIncome * (crop.name === '爱心果' ? 1 : 2),
    };
}

async function loadProto() {
    if (protoRoot) return protoRoot;
    protoRoot = new protobuf.Root();
    await protoRoot.load([
        path.join(__dirname, 'proto/game.proto'),
        path.join(__dirname, 'proto/userpb.proto'),
        path.join(__dirname, 'proto/plantpb.proto'),
        path.join(__dirname, 'proto/corepb.proto'),
        path.join(__dirname, 'proto/shoppb.proto'),
        path.join(__dirname, 'proto/friendpb.proto'),
        path.join(__dirname, 'proto/visitpb.proto'),
        path.join(__dirname, 'proto/notifypb.proto'),
        path.join(__dirname, 'proto/taskpb.proto'),
        path.join(__dirname, 'proto/itempb.proto'),
    ], { keepCase: true });
    return protoRoot;
}

function loadPlantConfig() {
    if (plantConfig) return plantConfig;
    const configPath = path.join(__dirname, 'gameConfig/Plant.json');
    plantConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return plantConfig;
}

function getPlantById(plantId) {
    const config = loadPlantConfig();
    return config.find(p => p.id === plantId);
}

function getPlantByName(name) {
    const config = loadPlantConfig();
    return config.find(p => p.name === name);
}

function parseMutantConfig(mutantStr) {
    if (!mutantStr || mutantStr.trim() === '') return [];
    const mutants = [];
    const parts = mutantStr.split(';');
    for (const part of parts) {
        const [phase, plantId] = part.split(':');
        if (phase && plantId) {
            mutants.push({
                phase: parseInt(phase),
                plantId: parseInt(plantId)
            });
        }
    }
    return mutants;
}

function formatTime(timestamp) {
    const d = new Date(timestamp * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

const PHASE_MAP = {
    0: { name: '未知', icon: '❓' },
    1: { name: '种子', icon: '🌰' },
    2: { name: '发芽', icon: '🌱' },
    3: { name: '小叶', icon: '🍃' },
    4: { name: '大叶', icon: '🌿' },
    5: { name: '开花', icon: '🌸' },
    6: { name: '成熟', icon: '🍎' },
    7: { name: '枯死', icon: '💀' }
};

function getPhaseInfo(phase) {
    return PHASE_MAP[phase] || { name: `阶段${phase}`, icon: '🌱' };
}

function getPhaseName(phase) {
    return getPhaseInfo(phase).name;
}

function getPhaseIcon(phase) {
    return getPhaseInfo(phase).icon;
}

const WEATHER_MAP = {
    0: { name: '晴朗', icon: '☀️' },
    1: { name: '多云', icon: '☁️' },
    2: { name: '下雨', icon: '🌧️' },
    3: { name: '刮风', icon: '🌬️' },
    4: { name: '雷电', icon: '⚡' },
    5: { name: '下雪', icon: '❄️' }
};

function getWeatherInfo(weatherId) {
    return WEATHER_MAP[weatherId] || { name: `天气${weatherId}`, icon: '❓' };
}

function getPlantIcon(plantName) {
    const iconMap = {
        '白萝卜': '🥕', '胡萝卜': '🥕', '大白菜': '🥬', '大蒜': '🧄', '大葱': '🌿',
        '水稻': '🌾', '小麦': '🌾', '玉米': '🌽', '土豆': '🥔', '番茄': '🍅',
        '茄子': '🍆', '辣椒': '🌶️', '黄瓜': '🥒', '南瓜': '🎃', '西瓜': '🍉',
        '草莓': '🍓', '苹果': '🍎', '香蕉': '🍌', '红枣': '🔴', '核桃': '🥜',
        '向日葵': '🌻', '玫瑰': '🌹', '百合': '🌸', '菊花': '🌼', '蒲公英': '🌨️',
        '满天星': '✨', '牵牛花': '🌀', '四叶草': '🍀', '荷花': '🪷', '牡丹': '🌺',
        '茉莉': '🫣', '桂花': '🌸', '薰衣草': '💜', '仙人掌': '🌵', '竹子': '🎋',
        '蘑菇': '🍄', '灵芝': '🍄', '人参': '🪴', '薄荷': '🌿', '艾草': '🌿',
        '樱花': '🌸', '梅花': '🌸', '兰花': '🌸', '茶花': '🌸', '杜鹃': '🌸',
        '海棠': '🌸', '栀子': '🌸', '月季': '🌹', '郁金香': '🌷', '康乃馨': '💐',
        '勿忘我': '💙', '风信子': '💜', '紫罗兰': '💜', '三色堇': '🌸', '马蹄莲': '⚪'
    };
    for (const [name, icon] of Object.entries(iconMap)) {
        if (plantName.includes(name)) return icon;
    }
    return '🌱';
}

async function parseHexMessage(hexData) {
    try {
        hexData = hexData.replace(/\s+/g, '');
        const buf = Buffer.from(hexData, 'hex');
        
        const GateMessage = protoRoot.lookupType('gatepb.Message');
        if (!GateMessage) throw new Error('GateMessage not found');
        
        const gateMsg = GateMessage.decode(buf);
        const meta = gateMsg.meta;
        
        const result = {
            success: true,
            meta,
            basic: {
                service: meta?.service_name || '未知',
                method: meta?.method_name || '未知',
                type: meta?.message_type,
                typeName: { 1: '请求', 2: '响应', 3: '推送' }[meta?.message_type] || '未知',
                clientSeq: meta?.client_seq?.toString() || 0,
                serverSeq: meta?.server_seq?.toString() || 0,
                errorCode: meta?.error_code?.toString() || null
            },
            bodyLength: gateMsg.body?.length || 0,
            landInfo: null,
            mutants: []
        };
        
        if (!gateMsg.body?.length) {
            result.error = '消息体为空';
            return result;
        }
        
        let bodyData = gateMsg.body;
        
        if (meta?.message_type === 2) {
            const serviceName = meta?.service_name || '';
            const methodName = meta?.method_name || '';
            
            if (serviceName.includes('VisitService') || methodName.includes('Enter')) {
                const EnterReply = protoRoot.lookupType('gamepb.visitpb.EnterReply');
                if (EnterReply) {
                    try {
                        const reply = EnterReply.decode(bodyData);
                        result.landInfo = reply.lands || [];
                        result.mutants = extractMutants(result.landInfo);
                        result.mutantCount = result.mutants.length;
                        if (reply.basic) {
                            result.friendInfo = {
                                gid: reply.basic.gid?.toString(),
                                name: reply.basic.name || '未知',
                                avatar: reply.basic.avatar?.toString() || ''
                            };
                        }
                        return result;
                    } catch (e) {
                        console.log('解析EnterReply失败:', e.message);
                    }
                }
            }
            
            const AllLandsReply = protoRoot.lookupType('gamepb.plantpb.AllLandsReply');
            if (AllLandsReply) {
                try {
                    const reply = AllLandsReply.decode(bodyData);
                    result.landInfo = reply.lands || [];
                    result.mutants = extractMutants(result.landInfo);
                    result.mutantCount = result.mutants.length;
                } catch (e) {
                    console.log('解析AllLandsReply失败:', e.message);
                }
            }
            
            if (!result.landInfo || result.landInfo.length === 0) {
                const LandInfo = protoRoot.lookupType('gamepb.plantpb.LandInfo');
                if (LandInfo) {
                    try {
                        const land = LandInfo.decode(bodyData);
                        result.landInfo = [land];
                        result.mutants = extractMutants(result.landInfo);
                        result.mutantCount = result.mutants.length;
                    } catch (e) {
                        console.log('解析LandInfo失败:', e.message);
                    }
                }
            }
        }
        
        return result;
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ==================== 历史记录管理 ====================
const historyFile = path.join(CONFIG.historyDir, 'history.json');

function getHistory() {
    try {
        return fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : [];
    } catch { return []; }
}

function addHistory(hexData, parseResult, source = 'manual') {
    try {
        let history = getHistory();
        if (history.length >= CONFIG.historyLimit) history = history.slice(0, CONFIG.historyLimit - 1);
        history.unshift({
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            hex: hexData.substring(0, 100) + (hexData.length > 100 ? '...' : ''),
            fullHex: hexData,
            service: parseResult?.basic?.service || '未知',
            method: parseResult?.basic?.method || '未知',
            type: parseResult?.basic?.typeName || '未知',
            typeCode: parseResult?.basic?.type,
            mutantCount: parseResult?.mutantCount || 0,
            success: parseResult?.success !== false,
            source
        });
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (e) { console.error('保存历史记录失败:', e); }
}

const MUTATION_TYPE_MAP = {
    1: { name: '冰冻', icon: '❄️', type: 1, class: 'mutant-ice', color: '#3b82f6' },
    2: { name: '爱心', icon: '❤️', type: 2, class: 'mutant-love', color: '#ec4899' },
    3: { name: '暗化', icon: '🌑', type: 3, class: 'mutant-dark', color: '#1f2937' },
    4: { name: '湿润', icon: '💧', type: 4, class: 'mutant-wet', color: '#06b6d4' },
    5: { name: '黄金', icon: '✨', type: 5, class: 'mutant-gold', color: '#eab308' },
    6: { name: '哈哈', icon: '🎃', type: 6, class: 'mutant-pumpkin', color: '#ea580c' },
    7: { name: '塔塔', icon: '🏰', type: 7, class: 'mutant-tower', color: '#7c3aed' },
    55: { name: '水晶', icon: '💎', type: 55, class: 'mutant-crystal', color: '#a855f7' },
    105: { name: '闪耀', icon: '⭐', type: 105, class: 'mutant-shine', color: '#fbbf24' },
    337: { name: '幸运', icon: '🍀', type: 337, class: 'mutant-lucky', color: '#22c55e' },
    393: { name: '冰晶', icon: '🔹', type: 393, class: 'mutant-ice-crystal', color: '#0ea5e9' },
    402: { name: '沙漠', icon: '🏜️', type: 402, class: 'mutant-desert', color: '#d97706' },
    611: { name: '奢华', icon: '👑', type: 611, class: 'mutant-luxury', color: '#f59e0b' },
    671: { name: '落雪', icon: '🌨️', type: 671, class: 'mutant-snow', color: '#e0f2fe' },
};

function getMutantTypeById(mutantConfigId) {
    if (MUTATION_TYPE_MAP[mutantConfigId]) {
        return MUTATION_TYPE_MAP[mutantConfigId];
    }
    const baseId = Math.floor(mutantConfigId / 100) * 100;
    if (MUTATION_TYPE_MAP[baseId]) {
        return MUTATION_TYPE_MAP[baseId];
    }
    return { name: '变异', icon: '✨', type: 0, class: 'mutant-gold', color: '#eab308' };
}

function extractMutants(lands) {
    const mutants = [];
    
    for (const land of lands) {
        if (!land.plant) continue;
        
        const plantInfo = land.plant;
        const plantId = plantInfo.id;
        const basePlant = getPlantById(plantId);
        const plantName = basePlant?.name || `未知作物(${plantId})`;
        const plantIcon = getPlantIcon(plantName);
        
        const lastPhase = plantInfo.phases?.[plantInfo.phases.length - 1];
        const phase = lastPhase?.phase || 0;
        const phaseInfo = getPhaseInfo(phase);
        
        let hasMutant = false;
        let mutantDetails = [];
        let primaryMutantType = 1;
        
        if (plantInfo.mutant_config_ids && plantInfo.mutant_config_ids.length > 0) {
            hasMutant = true;
            for (const mutantId of plantInfo.mutant_config_ids) {
                const mutantPlant = getPlantById(mutantId);
                const mutantName = mutantPlant?.name || `未知(${mutantId})`;
                const mutantTypeInfo = getMutantTypeById(mutantId);
                if (mutantDetails.length === 0) {
                    primaryMutantType = mutantTypeInfo.type;
                }
                mutantDetails.push({
                    configId: mutantId,
                    name: mutantName,
                    icon: getPlantIcon(mutantName),
                    plant: mutantPlant,
                    mutantType: mutantTypeInfo.name,
                    mutantTypeId: mutantTypeInfo.type,
                    mutantTypeIcon: mutantTypeInfo.icon
                });
            }
        }
        
        if (plantInfo.phases) {
            for (const phaseItem of plantInfo.phases) {
                if (phaseItem.mutants && phaseItem.mutants.length > 0) {
                    hasMutant = true;
                    for (const mutant of phaseItem.mutants) {
                        const mutantPlant = getPlantById(mutant.mutant_config_id);
                        const mutantName = mutantPlant?.name || `未知(${mutant.mutant_config_id})`;
                        if (!mutantDetails.find(m => m.configId === mutant.mutant_config_id)) {
                            const weatherInfo = getWeatherInfo(mutant.weather_id);
                            const mutantTypeInfo = getMutantTypeById(mutant.mutant_config_id);
                            if (mutantDetails.length === 0) {
                                primaryMutantType = mutantTypeInfo.type;
                            }
                            mutantDetails.push({
                                configId: mutant.mutant_config_id,
                                name: mutantName,
                                icon: getPlantIcon(mutantName),
                                plant: mutantPlant,
                                mutantTime: formatTime(mutant.mutant_time),
                                weatherId: mutant.weather_id,
                                weatherName: weatherInfo.name,
                                weatherIcon: weatherInfo.icon,
                                phase: phaseItem.phase,
                                phaseName: getPhaseName(phaseItem.phase),
                                phaseIcon: getPhaseIcon(phaseItem.phase),
                                mutantType: mutantTypeInfo.name,
                                mutantTypeId: mutantTypeInfo.type,
                                mutantTypeIcon: mutantTypeInfo.icon
                            });
                        }
                    }
                }
            }
        }
        
        if (hasMutant) {
            const primaryMutantTypeInfo = getMutantTypeById(mutantDetails[0]?.configId || primaryMutantType);
            mutants.push({
                landId: land.id,
                plantId: plantId,
                plantName: plantName,
                plantIcon: plantIcon,
                plant: basePlant,
                phase: phase,
                phaseName: phaseInfo.name,
                phaseIcon: phaseInfo.icon,
                mutantDetails,
                mutantType: primaryMutantType,
                mutantTypeInfo: primaryMutantTypeInfo,
                stealable: plantInfo.stealable,
                fruitNum: plantInfo.fruit_num,
                leftFruitNum: plantInfo.left_fruit_num,
                growSec: plantInfo.grow_sec,
                dryNum: plantInfo.dry_num,
                hasWeeds: (plantInfo.weed_owners && plantInfo.weed_owners.length > 0),
                hasInsects: (plantInfo.insect_owners && plantInfo.insect_owners.length > 0)
            });
        }
    }
    
    return mutants;
}

app.get('/', async (req, res) => {
    try {
        await loadProto();
        loadPlantConfig();
        res.render('index', { 
            result: null, 
            hexInput: '',
            history: getHistory(),
            formatTime 
        });
    } catch (e) {
        res.render('index', { 
            result: { success: false, error: e.message },
            hexInput: '',
            history: getHistory(),
            formatTime 
        });
    }
});

app.post('/', async (req, res) => {
    try {
        const { hex, source = 'manual' } = req.body;
        if (!hex) {
            return res.render('index', { 
                result: { success: false, error: '请输入Hex数据' },
                hexInput: hex,
                history: getHistory(),
                formatTime 
            });
        }
        
        await loadProto();
        loadPlantConfig();
        
        const result = await parseHexMessage(hex);
        
        // 只有成功解析才加入历史记录
        if (result.success !== false) {
            addHistory(hex, result, source);
        }
        
        res.render('index', { result, hexInput: hex, history: getHistory(), formatTime });
    } catch (e) {
        res.render('index', { 
            result: { success: false, error: e.message },
            hexInput: req.body.hex,
            history: getHistory(),
            formatTime 
        });
    }
});

app.post('/parse', async (req, res) => {
    try {
        const { hex, source = 'manual' } = req.body;
        if (!hex) {
            return res.render('index', { 
                result: { success: false, error: '请输入Hex数据' },
                hexInput: hex,
                history: getHistory(),
                formatTime 
            });
        }
        
        await loadProto();
        loadPlantConfig();
        
        const result = await parseHexMessage(hex);
        
        // 只有成功解析才加入历史记录
        if (result.success !== false) {
            addHistory(hex, result, source);
        }
        
        res.render('index', { result, hexInput: hex, history: getHistory(), formatTime });
    } catch (e) {
        res.render('index', { 
            result: { success: false, error: e.message },
            hexInput: req.body.hex,
            history: getHistory(),
            formatTime 
        });
    }
});

app.post('/api/parse', async (req, res) => {
    try {
        const { hex, source = 'api' } = req.body;
        if (!hex) return res.status(400).json({ success: false, error: '请输入Hex数据' });
        
        await loadProto();
        loadPlantConfig();
        
        const result = await parseHexMessage(hex);
        
        // 只有成功解析才加入历史记录
        if (result.success !== false) {
            addHistory(hex, result, source);
        }
        
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 历史记录相关路由
app.get('/history/:id', async (req, res) => {
    try {
        const history = getHistory();
        const item = history.find(h => h.id == req.params.id);
        if (!item) return res.status(404).send('历史记录不存在');
        await loadProto();
        loadPlantConfig();
        const result = await parseHexMessage(item.fullHex);
        res.render('index', { result, hexInput: item.fullHex, history, formatTime });
    } catch (e) {
        res.status(500).send('解析失败: ' + e.message);
    }
});

app.post('/history/clear', (req, res) => {
    try {
        fs.writeFileSync(historyFile, JSON.stringify([], null, 2));
        res.redirect('/');
    } catch (e) {
        res.status(500).send('清空失败: ' + e.message);
    }
});

app.post('/history/delete/:id', (req, res) => {
    try {
        let history = getHistory();
        history = history.filter(h => h.id != req.params.id);
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        res.json(getHistory());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/plants', (req, res) => {
    try {
        loadPlantConfig();
        res.json(plantConfig);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/plants/:id', (req, res) => {
    try {
        loadPlantConfig();
        const plant = getPlantById(parseInt(req.params.id));
        if (plant) {
            res.json(plant);
        } else {
            res.status(404).json({ error: '植物不存在' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 变异数据API
app.get('/api/mutation/crops', (req, res) => {
    res.json(MUTATION_CROPS);
});

app.get('/api/mutation/effects', (req, res) => {
    res.json(GRID_EFFECTS);
});

app.get('/api/mutation/weather', (req, res) => {
    res.json(WEATHER_TYPES);
});

app.get('/api/mutation/lands', (req, res) => {
    res.json(MULTI_LANDS);
});

app.get('/api/mutation/calculate', (req, res) => {
    try {
        const { crop, level } = req.query;
        if (!crop || !level) {
            return res.status(400).json({ error: '缺少参数' });
        }
        const result = calculateMutationProfit(crop, parseInt(level));
        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ error: '作物不存在' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/mutation/calculate-all', (req, res) => {
    try {
        const { level } = req.query;
        if (!level) {
            return res.status(400).json({ error: '缺少参数' });
        }
        const results = MUTATION_CROPS.map(crop => calculateMutationProfit(crop.name, parseInt(level)));
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(CONFIG.port, async () => {
    console.log(`🚀 农场变异查看器启动成功:`);
    console.log(`  本地: http://localhost:${CONFIG.port}`);
    try {
        await loadProto();
        loadPlantConfig();
        console.log('✅ Proto 加载完成');
        console.log('✅ 植物配置加载完成');
    } catch (e) {
        console.error('❌ 初始化失败:', e.message);
    }
});