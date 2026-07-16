import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const DIR = join(import.meta.dirname, '..', 'public', 'lyrics-text')
mkdirSync(DIR, { recursive: true })

const songs = [
  {
    filename: 'how-great-is-our-god',
    title: 'How Great Is Our God',
    slides: [
      { voice: 'A', text: 'The splendor of the King\nClothed in majesty\nLet all the earth rejoice\nAll the earth rejoice' },
      { voice: 'A', text: 'He wraps Himself in light\nAnd darkness tries to hide\nAnd trembles at His voice\nAnd trembles at His voice' },
      { voice: 'A', text: 'How great is our God\nSing with me\nHow great is our God\nAnd all will see\nHow great, how great\nIs our God' },
      { voice: 'A', text: 'And age to age He stands\nAnd time is in His hands\nBeginning and the End\nBeginning and the End' },
      { voice: 'A', text: 'The Godhead, three in one\nFather, Spirit, Son\nThe Lion and the Lamb\nThe Lion and the Lamb' },
      { voice: 'A', text: 'How great is our God\nSing with me\nHow great is our God\nAnd all will see\nHow great, how great\nIs our God' },
      { voice: 'A', text: 'Name above all names\nWorthy of all praise\nMy heart will sing\nHow great is our God' },
    ],
  },
  {
    filename: '10000-reasons-bless-the-lord',
    title: '10,000 Reasons (Bless the Lord)',
    slides: [
      { voice: 'A', text: 'Bless the Lord, O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI\'ll worship Your holy name' },
      { voice: 'A', text: 'The sun comes up\nIt\'s a new day dawning\nIt\'s time to sing Your song again\nWhatever may pass\nAnd whatever lies before me\nLet me be singing\nWhen the evening comes' },
      { voice: 'A', text: 'Bless the Lord, O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI\'ll worship Your holy name' },
      { voice: 'A', text: 'You\'re rich in love\nAnd You\'re slow to anger\nYour name is great\nAnd Your heart is kind\nFor all Your goodness\nI will keep on singing\nTen thousand reasons\nFor my heart to find' },
      { voice: 'A', text: 'Bless the Lord, O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI\'ll worship Your holy name' },
      { voice: 'A', text: 'And on that day\nWhen my strength is failing\nThe end draws near\nAnd my time has come\nStill my soul will sing\nYour praise unending\nTen thousand years\nAnd then forevermore' },
      { voice: 'A', text: 'Bless the Lord, O my soul\nO my soul\nWorship His holy name\nSing like never before\nO my soul\nI\'ll worship Your holy name' },
    ],
  },
  {
    filename: 'what-a-beautiful-name',
    title: 'What A Beautiful Name',
    slides: [
      { voice: 'A', text: 'You were the Word at the beginning\nOne with God the Lord Most High\nYour hidden glory in creation\nNow revealed in You our Christ' },
      { voice: 'A', text: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King\nWhat a beautiful Name it is\nNothing compares to this\nWhat a beautiful Name it is\nThe Name of Jesus' },
      { voice: 'A', text: 'You didn\'t want heaven without us\nSo Jesus, You brought heaven down\nMy sin was great, Your love was greater\nWhat could separate us now' },
      { voice: 'A', text: 'What a wonderful Name it is\nWhat a wonderful Name it is\nThe Name of Jesus Christ my King\nWhat a wonderful Name it is\nNothing compares to this\nWhat a wonderful Name it is\nThe Name of Jesus' },
      { voice: 'A', text: 'Death could not hold You\nThe veil tore before You\nYou silence the boast of sin and grave\nThe heavens are roaring\nThe praise of Your glory\nFor You are raised to life again' },
      { voice: 'A', text: 'What a powerful Name it is\nWhat a powerful Name it is\nThe Name of Jesus Christ my King\nWhat a powerful Name it is\nNothing can stand against\nWhat a powerful Name it is\nThe Name of Jesus' },
    ],
  },
  {
    filename: 'oceans-where-feet-may-fail',
    title: 'Oceans (Where Feet May Fail)',
    slides: [
      { voice: 'A', text: 'You call me out upon the waters\nThe great unknown\nWhere feet may fail\nAnd there I find You in the mystery\nIn oceans deep\nMy faith will stand' },
      { voice: 'A', text: 'And I will call upon Your name\nAnd keep my eyes above the waves\nWhen oceans rise\nMy soul will rest in Your embrace\nFor I am Yours\nAnd You are mine' },
      { voice: 'A', text: 'Your grace abounds in deepest waters\nYour sovereign hand\nWill be my guide\nWhere feet may fail\nAnd fear surrounds me\nYou\'ve never failed\nAnd You won\'t start now' },
      { voice: 'A', text: 'And I will call upon Your name\nAnd keep my eyes above the waves\nWhen oceans rise\nMy soul will rest in Your embrace\nFor I am Yours\nAnd You are mine' },
      { voice: 'A', text: 'Spirit lead me\nWhere my trust is without borders\nLet me walk upon the waters\nWherever You would call me\nTake me deeper than my feet\nCould ever wander\nAnd my faith will be made stronger\nIn the presence of my Saviour' },
    ],
  },
  {
    filename: 'good-good-father',
    title: 'Good Good Father',
    slides: [
      { voice: 'A', text: 'I\'ve heard a thousand stories\nOf what they think You\'re like\nBut I\'ve heard the tender whisper\nOf love in the dead of night\nAnd You tell me that You\'re pleased\nAnd that I\'m never alone' },
      { voice: 'A', text: 'You\'re a good, good Father\nIt\'s who You are, it\'s who You are\nIt\'s who You are\nAnd I\'m loved by You\nIt\'s who I am, it\'s who I am\nIt\'s who I am' },
      { voice: 'A', text: 'I\'ve seen many searching\nFor answers far and wide\nBut I know we\'re all searching\nFor answers only You provide\n\'Cause You know just what we need\nBefore we say a word' },
      { voice: 'A', text: 'You\'re a good, good Father\nIt\'s who You are, it\'s who You are\nIt\'s who You are\nAnd I\'m loved by You\nIt\'s who I am, it\'s who I am\nIt\'s who I am' },
      { voice: 'A', text: 'You are perfect in all of Your ways\nYou are perfect in all of Your ways\nYou are perfect in all of Your ways to us' },
      { voice: 'A', text: 'Love so undeniable I can hardly speak\nPeace so unexplainable I can hardly think\nAs You call me deeper still\nAs You call me deeper still\nAs You call me deeper still\nInto love, love, love' },
    ],
  },
  {
    filename: 'reckless-love',
    title: 'Reckless Love',
    slides: [
      { voice: 'A', text: 'Before I spoke a word\nYou were singing over me\nYou have been so, so good to me\nBefore I took a breath\nYou breathed Your life in me\nYou have been so, so kind to me' },
      { voice: 'A', text: 'O the overwhelming, never-ending\nReckless love of God\nO it chases me down\nFights till I\'m found\nLeaves the ninety-nine\nI couldn\'t earn it\nI don\'t deserve it\nStill You give Yourself away\nO the overwhelming, never-ending\nReckless love of God' },
      { voice: 'A', text: 'When I was Your foe\nStill Your love fought for me\nYou have been so, so good to me\nWhen I felt no worth\nYou paid it all for me\nYou have been so, so kind to me' },
      { voice: 'A', text: 'O the overwhelming, never-ending\nReckless love of God\nO it chases me down\nFights till I\'m found\nLeaves the ninety-nine\nI couldn\'t earn it\nI don\'t deserve it\nStill You give Yourself away\nO the overwhelming, never-ending\nReckless love of God' },
      { voice: 'A', text: 'There\'s no shadow You won\'t light up\nMountain You won\'t climb up\nComing after me\nThere\'s no wall You won\'t kick down\nLie You won\'t tear down\nComing after me' },
    ],
  },
  {
    filename: 'way-maker',
    title: 'Way Maker',
    slides: [
      { voice: 'A', text: 'You are here, moving in our midst\nI worship You, I worship You\nYou are here, working in this place\nI worship You, I worship You' },
      { voice: 'A', text: 'Way maker, miracle worker\nPromise keeper, light in the darkness\nMy God, that is who You are\nWay maker, miracle worker\nPromise keeper, light in the darkness\nMy God, that is who You are' },
      { voice: 'A', text: 'You are here, touching every heart\nI worship You, I worship You\nYou are here, healing every heart\nI worship You, I worship You' },
      { voice: 'A', text: 'Way maker, miracle worker\nPromise keeper, light in the darkness\nMy God, that is who You are\nWay maker, miracle worker\nPromise keeper, light in the darkness\nMy God, that is who You are' },
      { voice: 'A', text: 'You are here, turning lives around\nI worship You, I worship You\nYou are here, mending every heart\nI worship You, I worship You' },
      { voice: 'A', text: 'Even when I don\'t see it\nYou\'re working\nEven when I don\'t feel it\nYou\'re working\nYou never stop\nYou never stop working\nYou never stop\nYou never stop working' },
    ],
  },
  {
    filename: 'great-are-you-lord',
    title: 'Great Are You Lord',
    slides: [
      { voice: 'A', text: 'You give life, You are love\nYou bring light to the darkness\nYou give hope, You restore\nEvery heart that is broken\nGreat are You, Lord' },
      { voice: 'A', text: 'It\'s Your breath in our lungs\nSo we pour out our praise\nWe pour out our praise\nIt\'s Your breath in our lungs\nSo we pour out our praise to You only' },
      { voice: 'A', text: 'You give life, You are love\nYou bring light to the darkness\nYou give hope, You restore\nEvery heart that is broken\nGreat are You, Lord' },
      { voice: 'A', text: 'It\'s Your breath in our lungs\nSo we pour out our praise\nWe pour out our praise\nIt\'s Your breath in our lungs\nSo we pour out our praise to You only' },
      { voice: 'A', text: 'All the earth will shout Your praise\nOur hearts will cry, these bones will sing\nGreat are You, Lord' },
    ],
  },
  {
    filename: 'build-my-life',
    title: 'Build My Life',
    slides: [
      { voice: 'A', text: 'Worthy of every song we could ever sing\nWorthy of all the praise we could ever bring\nWorthy of every breath we could ever breathe\nWe live for You' },
      { voice: 'A', text: 'Jesus the Name above every other name\nJesus the only One who could ever save\nWorthy of every breath we could ever breathe\nWe live for You, we live for You' },
      { voice: 'A', text: 'Holy, there is no one like You\nThere is none beside You\nOpen up my eyes in wonder\nAnd show me who You are\nAnd fill me with Your heart\nAnd lead me in Your love\nTo those around me' },
      { voice: 'A', text: 'I will build my life upon Your love\nIt is a firm foundation\nI will put my trust in You alone\nAnd I will not be shaken' },
    ],
  },
  {
    filename: 'king-of-kings',
    title: 'King of Kings',
    slides: [
      { voice: 'A', text: 'In the darkness we were waiting\nWithout hope, without light\nTill from Heaven You came running\nThere was mercy in Your eyes' },
      { voice: 'A', text: 'To fulfil the law and prophets\nTo a virgin came the Word\nFrom a throne of endless glory\nTo a cradle in the dirt' },
      { voice: 'A', text: 'Praise the Father, praise the Son\nPraise the Spirit, three in one\nGod of glory, Majesty\nPraise forever to the King of Kings' },
      { voice: 'A', text: 'To reveal the kingdom coming\nAnd to reconcile the lost\nTo redeem the whole creation\nYou did not despise the cross' },
      { voice: 'A', text: 'For even in Your suffering\nYou saw to the other side\nKnowing this was our salvation\nJesus, for our sake You died' },
      { voice: 'A', text: 'Praise the Father, praise the Son\nPraise the Spirit, three in one\nGod of glory, Majesty\nPraise forever to the King of Kings' },
      { voice: 'A', text: 'And the morning that You rose\nAll of heaven held its breath\nTill that stone was moved for good\nFor the Lamb had conquered death' },
      { voice: 'A', text: 'And the dead rose from their tombs\nAnd the angels stood in awe\nFor the souls of all who\'d come\nTo the Father are restored' },
      { voice: 'A', text: 'And the Church of Christ was born\nThen the Spirit lit the flame\nNow this Gospel truth of old\nShall not kneel, shall not faint' },
      { voice: 'A', text: 'By His blood and in His Name\nIn His freedom I am free\nFor the love of Jesus Christ\nWho has resurrected me' },
      { voice: 'A', text: 'Praise the Father, praise the Son\nPraise the Spirit, three in one\nGod of glory, Majesty\nPraise forever to the King of Kings' },
    ],
  },
  {
    filename: 'amazing-grace',
    title: 'Amazing Grace',
    slides: [
      { voice: 'A', text: 'Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see' },
      { voice: 'A', text: '\'Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed' },
      { voice: 'A', text: 'Through many dangers, toils and snares\nI have already come\n\'Tis grace hath brought me safe thus far\nAnd grace will lead me home' },
      { voice: 'A', text: 'The Lord has promised good to me\nHis word my hope secures\nHe will my shield and portion be\nAs long as life endures' },
      { voice: 'A', text: 'When we\'ve been there ten thousand years\nBright shining as the sun\nWe\'ve no less days to sing God\'s praise\nThan when we\'d first begun' },
    ],
  },
  {
    filename: 'how-great-thou-art',
    title: 'How Great Thou Art',
    slides: [
      { voice: 'A', text: 'O Lord my God\nWhen I in awesome wonder\nConsider all the worlds\nThy hands have made\nI see the stars\nI hear the rolling thunder\nThy power throughout\nThe universe displayed' },
      { voice: 'A', text: 'Then sings my soul\nMy Saviour God, to Thee\nHow great Thou art\nHow great Thou art\nThen sings my soul\nMy Saviour God, to Thee\nHow great Thou art\nHow great Thou art' },
      { voice: 'A', text: 'When through the woods\nAnd forest glades I wander\nAnd hear the birds\nSing sweetly in the trees\nWhen I look down\nFrom lofty mountain grandeur\nAnd hear the brook\nAnd feel the gentle breeze' },
      { voice: 'A', text: 'Then sings my soul\nMy Saviour God, to Thee\nHow great Thou art\nHow great Thou art\nThen sings my soul\nMy Saviour God, to Thee\nHow great Thou art\nHow great Thou art' },
      { voice: 'A', text: 'And when I think\nThat God, His Son not sparing\nSent Him to die\nI scarce can take it in\nThat on the cross\nMy burden gladly bearing\nHe bled and died\nTo take away my sin' },
      { voice: 'A', text: 'When Christ shall come\nWith shout of acclamation\nAnd take me home\nWhat joy shall fill my heart\nThen I shall bow\nIn humble adoration\nAnd there proclaim\nMy God, how great Thou art' },
    ],
  },
  {
    filename: 'it-is-well-with-my-soul',
    title: 'It Is Well With My Soul',
    slides: [
      { voice: 'A', text: 'When peace like a river\nAttendeth my way\nWhen sorrows like sea billows roll\nWhatever my lot\nThou hast taught me to say\nIt is well, it is well with my soul' },
      { voice: 'A', text: 'It is well with my soul\nIt is well, it is well\nWith my soul' },
      { voice: 'A', text: 'Though Satan should buffet\nThough trials should come\nLet this blest assurance control\nThat Christ hath regarded\nMy helpless estate\nAnd hath shed His own blood\nFor my soul' },
      { voice: 'A', text: 'It is well with my soul\nIt is well, it is well\nWith my soul' },
      { voice: 'A', text: 'My sin, oh the bliss\nOf this glorious thought\nMy sin, not in part, but the whole\nIs nailed to the cross\nAnd I bear it no more\nPraise the Lord, praise the Lord\nO my soul' },
      { voice: 'A', text: 'And Lord, haste the day\nWhen my faith shall be sight\nThe clouds be rolled back as a scroll\nThe trump shall resound\nAnd the Lord shall descend\nEven so, it is well with my soul' },
    ],
  },
  {
    filename: 'great-is-thy-faithfulness',
    title: 'Great Is Thy Faithfulness',
    slides: [
      { voice: 'A', text: 'Great is Thy faithfulness\nO God my Father\nThere is no shadow\nOf turning with Thee\nThou changest not\nThy compassions they fail not\nAs Thou hast been\nThou forever wilt be' },
      { voice: 'A', text: 'Great is Thy faithfulness\nGreat is Thy faithfulness\nMorning by morning\nNew mercies I see\nAll I have needed\nThy hand hath provided\nGreat is Thy faithfulness\nLord unto me' },
      { voice: 'A', text: 'Summer and winter\nAnd springtime and harvest\nSun, moon and stars\nIn their courses above\nJoin with all nature\nIn manifold witness\nTo Thy great faithfulness\nMercy and love' },
      { voice: 'A', text: 'Great is Thy faithfulness\nGreat is Thy faithfulness\nMorning by morning\nNew mercies I see\nAll I have needed\nThy hand hath provided\nGreat is Thy faithfulness\nLord unto me' },
      { voice: 'A', text: 'Pardon for sin\nAnd a peace that endureth\nThine own dear presence\nTo cheer and to guide\nStrength for today\nAnd bright hope for tomorrow\nBlessings all mine\nWith ten thousand beside' },
    ],
  },
  {
    filename: 'be-thou-my-vision',
    title: 'Be Thou My Vision',
    slides: [
      { voice: 'A', text: 'Be Thou my vision\nO Lord of my heart\nNaught be all else to me\nSave that Thou art\nThou my best thought\nBy day or by night\nWaking or sleeping\nThy presence my light' },
      { voice: 'A', text: 'Be Thou my wisdom\nAnd Thou my true Word\nI ever with Thee\nAnd Thou with me Lord\nThou my great Father\nI Thy true son\nThou in me dwelling\nAnd I with Thee one' },
      { voice: 'A', text: 'Riches I heed not\nNor man\'s empty praise\nThou mine inheritance\nNow and always\nThou and Thou only\nFirst in my heart\nHigh King of heaven\nMy treasure Thou art' },
      { voice: 'A', text: 'High King of heaven\nMy victory won\nMay I reach heaven\'s joys\nO bright heaven\'s sun\nHeart of my own heart\nWhatever befall\nStill be my vision\nO Ruler of all' },
    ],
  },
  {
    filename: 'holy-holy-holy',
    title: 'Holy Holy Holy',
    slides: [
      { voice: 'A', text: 'Holy, holy, holy\nLord God Almighty\nEarly in the morning\nOur song shall rise to Thee\nHoly, holy, holy\nMerciful and mighty\nGod in three Persons\nBlessed Trinity' },
      { voice: 'A', text: 'Holy, holy, holy\nAll the saints adore Thee\nCasting down their golden crowns\nAround the glassy sea\nCherubim and seraphim\nFalling down before Thee\nWhich wert and art\nAnd evermore shalt be' },
      { voice: 'A', text: 'Holy, holy, holy\nThough the darkness hide Thee\nThough the eye of sinful man\nThy glory may not see\nOnly Thou art holy\nThere is none beside Thee\nPerfect in power\nIn love and purity' },
      { voice: 'A', text: 'Holy, holy, holy\nLord God Almighty\nAll Thy works shall praise Thy name\nIn earth and sky and sea\nHoly, holy, holy\nMerciful and mighty\nGod in three Persons\nBlessed Trinity' },
    ],
  },
  {
    filename: 'blessed-assurance',
    title: 'Blessed Assurance',
    slides: [
      { voice: 'A', text: 'Blessed assurance, Jesus is mine\nO what a foretaste of glory divine\nHeir of salvation, purchase of God\nBorn of His Spirit, washed in His blood' },
      { voice: 'A', text: 'This is my story, this is my song\nPraising my Saviour all the day long\nThis is my story, this is my song\nPraising my Saviour all the day long' },
      { voice: 'A', text: 'Perfect submission, perfect delight\nVisions of rapture now burst on my sight\nAngels descending bring from above\nEchoes of mercy, whispers of love' },
      { voice: 'A', text: 'This is my story, this is my song\nPraising my Saviour all the day long\nThis is my story, this is my song\nPraising my Saviour all the day long' },
      { voice: 'A', text: 'Perfect submission, all is at rest\nI in my Saviour am happy and blest\nWatching and waiting, looking above\nFilled with His goodness, lost in His love' },
    ],
  },
  {
    filename: 'what-a-friend-we-have-in-jesus',
    title: 'What A Friend We Have In Jesus',
    slides: [
      { voice: 'A', text: 'What a friend we have in Jesus\nAll our sins and griefs to bear\nWhat a privilege to carry\nEverything to God in prayer' },
      { voice: 'A', text: 'O what peace we often forfeit\nO what needless pain we bear\nAll because we do not carry\nEverything to God in prayer' },
      { voice: 'A', text: 'Have we trials and temptations\nIs there trouble anywhere\nWe should never be discouraged\nTake it to the Lord in prayer' },
      { voice: 'A', text: 'Can we find a friend so faithful\nWho will all our sorrows share\nJesus knows our every weakness\nTake it to the Lord in prayer' },
      { voice: 'A', text: 'Are we weak and heavy laden\nCumbered with a load of care\nPrecious Saviour, still our refuge\nTake it to the Lord in prayer' },
      { voice: 'A', text: 'Do thy friends despise forsake thee\nTake it to the Lord in prayer\nIn His arms He\'ll take and shield thee\nThou wilt find a solace there' },
    ],
  },
  {
    filename: 'the-old-rugged-cross',
    title: 'The Old Rugged Cross',
    slides: [
      { voice: 'A', text: 'On a hill far away\nStood an old rugged cross\nThe emblem of suffering and shame\nAnd I love that old cross\nWhere the dearest and best\nFor a world of lost sinners was slain' },
      { voice: 'A', text: 'So I\'ll cherish the old rugged cross\nTill my trophies at last I lay down\nI will cling to the old rugged cross\nAnd exchange it someday for a crown' },
      { voice: 'A', text: 'O that old rugged cross\nSo despised by the world\nHas a wondrous attraction for me\nFor the dear Lamb of God\nLeft His glory above\nTo bear it to dark Calvary' },
      { voice: 'A', text: 'In that old rugged cross\nStained with blood so divine\nA wondrous beauty I see\nFor \'twas on that old cross\nJesus suffered and died\nTo pardon and sanctify me' },
      { voice: 'A', text: 'So I\'ll cherish the old rugged cross\nTill my trophies at last I lay down\nI will cling to the old rugged cross\nAnd exchange it someday for a crown' },
    ],
  },
  {
    filename: 'in-christ-alone',
    title: 'In Christ Alone',
    slides: [
      { voice: 'A', text: 'In Christ alone my hope is found\nHe is my light, my strength, my song\nThis Cornerstone, this solid ground\nFirm through the fiercest\nDrought and storm' },
      { voice: 'A', text: 'What heights of love\nWhat depths of peace\nWhen fears are stilled\nWhen strivings cease\nMy Comforter, my All in All\nHere in the love of Christ I stand' },
      { voice: 'A', text: 'In Christ alone, who took on flesh\nFullness of God in helpless babe\nThis gift of love and righteousness\nScorned by the ones\nHe came to save' },
      { voice: 'A', text: 'Till on that cross as Jesus died\nThe wrath of God was satisfied\nFor every sin on Him was laid\nHere in the death of Christ I live' },
      { voice: 'A', text: 'There in the ground His body lay\nLight of the world by darkness slain\nThen bursting forth in glorious day\nUp from the grave He rose again' },
      { voice: 'A', text: 'No guilt in life, no fear in death\nThis is the power of Christ in me\nFrom life\'s first cry to final breath\nJesus commands my destiny' },
      { voice: 'A', text: 'No power of hell, no scheme of man\nCan ever pluck me from His hand\nTill He returns or calls me home\nHere in the power of Christ I\'ll stand' },
    ],
  },
  {
    filename: 'shout-to-the-lord',
    title: 'Shout To The Lord',
    slides: [
      { voice: 'A', text: 'My Jesus, my Saviour\nLord, there is none like You\nAll of my days, I want to praise\nThe wonders of Your mighty love' },
      { voice: 'A', text: 'My comfort, my shelter\nTower of refuge and strength\nLet every breath, all that I am\nNever cease to worship You' },
      { voice: 'A', text: 'Shout to the Lord\nAll the earth, let us sing\nPower and majesty\nPraise to the King\nMountains bow down\nAnd the seas will roar\nAt the sound of Your name' },
      { voice: 'A', text: 'I sing for joy\nAt the work of Your hands\nForever I\'ll love You\nForever I\'ll stand\nNothing compares to the promise\nI have in You' },
    ],
  },
  {
    filename: 'mighty-to-save',
    title: 'Mighty To Save',
    slides: [
      { voice: 'A', text: 'Everyone needs compassion\nA love that\'s never failing\nLet mercy fall on me\nEveryone needs forgiveness\nThe kindness of a Saviour\nThe hope of nations' },
      { voice: 'A', text: 'Saviour, He can move the mountains\nMy God is mighty to save\nHe is mighty to save\nForever, Author of salvation\nHe rose and conquered the grave\nJesus conquered the grave' },
      { voice: 'A', text: 'So take me as You find me\nAll my fears and failures\nFill my life again\nI give my life to follow\nEverything I believe in\nNow I surrender' },
      { voice: 'A', text: 'Saviour, He can move the mountains\nMy God is mighty to save\nHe is mighty to save\nForever, Author of salvation\nHe rose and conquered the grave\nJesus conquered the grave' },
      { voice: 'A', text: 'Shine Your light and\nLet the whole world see\nWe\'re singing\nFor the glory of the risen King\nJesus, shine Your light and\nLet the whole world see\nWe\'re singing\nFor the glory of the risen King' },
    ],
  },
  {
    filename: 'here-i-am-to-worship',
    title: 'Here I Am To Worship',
    slides: [
      { voice: 'A', text: 'Light of the world\nYou stepped down into darkness\nOpened my eyes, let me see\nBeauty that made\nThis heart adore You\nHope of a life spent with You' },
      { voice: 'A', text: 'Here I am to worship\nHere I am to bow down\nHere I am to say that You\'re my God\nYou\'re altogether lovely\nAltogether worthy\nAltogether wonderful to me' },
      { voice: 'A', text: 'King of all days\nOh so highly exalted\nGlorious in heaven above\nHumbly You came\nTo the earth You created\nAll for love\'s sake became poor' },
      { voice: 'A', text: 'Here I am to worship\nHere I am to bow down\nHere I am to say that You\'re my God\nYou\'re altogether lovely\nAltogether worthy\nAltogether wonderful to me' },
      { voice: 'A', text: 'I\'ll never know how much it cost\nTo see my sin upon that cross\nI\'ll never know how much it cost\nTo see my sin upon that cross' },
    ],
  },
  {
    filename: 'cornerstone',
    title: 'Cornerstone',
    slides: [
      { voice: 'A', text: 'My hope is built on nothing less\nThan Jesus\' blood and righteousness\nI dare not trust the sweetest frame\nBut wholly trust in Jesus\' name' },
      { voice: 'A', text: 'Christ alone, Cornerstone\nWeak made strong\nIn the Saviour\'s love\nThrough the storm\nHe is Lord, Lord of all' },
      { voice: 'A', text: 'When darkness seems to hide His face\nI rest on His unchanging grace\nIn every high and stormy gale\nMy anchor holds within the veil' },
      { voice: 'A', text: 'Christ alone, Cornerstone\nWeak made strong\nIn the Saviour\'s love\nThrough the storm\nHe is Lord, Lord of all' },
      { voice: 'A', text: 'When He shall come with trumpet sound\nOh may I then in Him be found\nDressed in His righteousness alone\nFaultless to stand before the throne' },
    ],
  },
  {
    filename: 'no-longer-slaves',
    title: 'No Longer Slaves',
    slides: [
      { voice: 'A', text: 'You unravel me with a melody\nYou surround me with a song\nOf deliverance from my enemies\nTill all my fears are gone' },
      { voice: 'A', text: 'I\'m no longer a slave to fear\nI am a child of God\nI\'m no longer a slave to fear\nI am a child of God' },
      { voice: 'A', text: 'From my Mother\'s womb\nYou have chosen me\nLove has called my name\nI\'ve been born again into a family\nYour blood flows through my veins' },
      { voice: 'A', text: 'I\'m no longer a slave to fear\nI am a child of God\nI\'m no longer a slave to fear\nI am a child of God' },
      { voice: 'A', text: 'I am surrounded\nBy the arms of the Father\nI am surrounded\nBy songs of deliverance\nWe\'ve been liberated\nFrom our bondage\nWe\'re the sons and the daughters\nLet us sing our freedom' },
    ],
  },
  {
    filename: 'goodness-of-god',
    title: 'Goodness Of God',
    slides: [
      { voice: 'A', text: 'I love You, Lord\nFor Your mercy never fails me\nAll my days, I\'ve been held\nIn Your hands\nFrom the moment that I wake up\nUntil I lay my head\nI will sing of the\nGoodness of God' },
      { voice: 'A', text: 'All my life You have been faithful\nAll my life You have been so, so good\nWith every breath that I am able\nI will sing of the goodness of God' },
      { voice: 'A', text: 'I love Your voice\nYou have led me through the fire\nIn darkest night\nYou are close like no other\nI\'ve known You as a Father\nI\'ve known You as a Friend\nI have lived in the\nGoodness of God' },
      { voice: 'A', text: 'All my life You have been faithful\nAll my life You have been so, so good\nWith every breath that I am able\nI will sing of the goodness of God' },
      { voice: 'A', text: 'Your goodness is running after\nIt\'s running after me\nYour goodness is running after\nIt\'s running after me\nWith my life laid down\nI\'m surrendered now\nI give You everything\nYour goodness is running after\nIt\'s running after me' },
    ],
  },
  {
    filename: 'the-blessing',
    title: 'The Blessing',
    slides: [
      { voice: 'A', text: 'The Lord bless you and keep you\nMake His face shine upon you\nAnd be gracious to you\nThe Lord turn His face toward you\nAnd give you peace' },
      { voice: 'A', text: 'The Lord bless you and keep you\nMake His face shine upon you\nAnd be gracious to you\nThe Lord turn His face toward you\nAnd give you peace' },
      { voice: 'A', text: 'Amen, amen, amen\nAmen, amen, amen' },
      { voice: 'A', text: 'May His favour be upon you\nAnd a thousand generations\nAnd your family\nAnd your children\nAnd their children\nAnd their children' },
      { voice: 'A', text: 'May His presence go before you\nAnd behind you and beside you\nAll around you\nAnd within you\nHe is with you, He is with you' },
      { voice: 'A', text: 'In the morning, in the evening\nIn your coming and your going\nIn your weeping and rejoicing\nHe is for you, He is for you' },
    ],
  },
  {
    filename: 'graves-into-gardens',
    title: 'Graves Into Gardens',
    slides: [
      { voice: 'A', text: 'I searched the world\nBut it couldn\'t fill me\nMan\'s empty praise\nAnd treasures that fade\nAre never enough' },
      { voice: 'A', text: 'Then You came along\nAnd put me back together\nAnd every desire\nIs now satisfied\nHere in Your love' },
      { voice: 'A', text: 'Oh there\'s nothing better than You\nThere\'s nothing better than You\nLord, there\'s nothing\nNothing is better than You' },
      { voice: 'A', text: 'I\'m not afraid\nTo show You my weakness\nMy failures and flaws\nLord, You\'ve seen them all\nAnd You still call me friend' },
      { voice: 'A', text: 'You turn mourning to dancing\nYou give beauty for ashes\nYou turn shame into glory\nYou\'re the only one who can' },
      { voice: 'A', text: 'You turn graves into gardens\nYou turn bones into armies\nYou turn seas into highways\nYou\'re the only one who can\nYou\'re the only one who can' },
    ],
  },
  {
    filename: 'holy-spirit',
    title: 'Holy Spirit',
    slides: [
      { voice: 'A', text: 'There\'s nothing worth more\nThat will ever come close\nNothing can compare\nYou\'re our living hope\nYour presence, Lord' },
      { voice: 'A', text: 'I\'ve tasted and seen\nOf the sweetest of loves\nWhere my heart becomes free\nAnd my shame is undone\nYour presence, Lord' },
      { voice: 'A', text: 'Holy Spirit, You are welcome here\nCome flood this place\nAnd fill the atmosphere\nYour glory, God\nIs what our hearts long for\nTo be overcome\nBy Your presence, Lord' },
      { voice: 'A', text: 'Let us become more aware\nOf Your presence\nLet us experience\nThe glory of Your goodness' },
      { voice: 'A', text: 'Holy Spirit, You are welcome here\nCome flood this place\nAnd fill the atmosphere\nYour glory, God\nIs what our hearts long for\nTo be overcome\nBy Your presence, Lord' },
    ],
  },
  {
    filename: 'lord-i-need-you',
    title: 'Lord I Need You',
    slides: [
      { voice: 'A', text: 'Lord, I come, I confess\nBowing here, I find my rest\nWithout You, I fall apart\nYou\'re the one that guides my heart' },
      { voice: 'A', text: 'Lord, I need You, oh I need You\nEvery hour I need You\nMy one defense, my righteousness\nOh God, how I need You' },
      { voice: 'A', text: 'Where sin runs deep\nYour grace is more\nWhere grace is found\nIs where You are\nAnd where You are\nLord, I am free\nHoliness is Christ in me' },
      { voice: 'A', text: 'Lord, I need You, oh I need You\nEvery hour I need You\nMy one defense, my righteousness\nOh God, how I need You' },
      { voice: 'A', text: 'So teach my song to rise to You\nWhen temptation comes my way\nAnd when I cannot stand, I\'ll fall on You\nJesus, You\'re my hope and stay' },
    ],
  },
]

function serialize(title, slides) {
  let content = `${title}\n==================\n`
  for (const s of slides) {
    content += `\n${s.voice}\n${s.text}\n`
  }
  return content
}

let count = 0
for (const song of songs) {
  const path = join(DIR, `${song.filename}.txt`)
  writeFileSync(path, serialize(song.title, song.slides), 'utf-8')
  count++
  console.log(`✓ ${song.filename}`)
}
console.log(`\nCreated ${count} song files`)
