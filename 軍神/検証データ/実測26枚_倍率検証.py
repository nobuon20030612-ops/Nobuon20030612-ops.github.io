from math import floor
import json,re,pathlib
# Original-game ability values in the supplied screen captures, index=HP,KI,ARM,END,DEX,INT,CHAR,EARTH,WATER,FIRE,WIND.
raw={
'T':(8,[1008,472,28,35,24,36,40,27,26,28,27]),
'I':(8,[949,480,28,25,32,34,40,34,33,15,29]),
'B':(7,[253,126,7,2,8,3,5,2,4,2,5]),
'N':(6,[715,352,23,26,22,25,31,24,22,24,22]),
'O':(6,[739,350,29,31,16,21,25,27,21,16,13]),
'K':(6,[739,352,29,30,17,29,31,15,17,13,14]),
'S':(6,[739,352,18,31,20,21,19,25,20,17,24]),
'W':(5,[275,137,0,1,1,8,10,4,4,4,4]),
'G':(4,[465,225,18,15,11,12,19,11,16,9,11]),
'U':(3,[283,148,7,7,7,9,9,8,7,9,10]),
'H':(3,[324,162,10,10,4,6,10,8,9,7,7]),
'A':(4,[473,225,13,16,12,18,20,10,13,11,10]),
}
base_life=[None,100,105,110,115,120,130]
base_rest=[None,300,320,360,420,500,600]
per_cost={8:0,7:5,6:10,5:10,4:15,3:15}
def prediction(keys):
 n=len(keys);bonus=sum(per_cost[raw[k][0]] for k in keys)
 vals=[sum(raw[k][1][i] for k in keys) for i in range(11)]
 return [floor(v*(base_life[n]+bonus if i<2 else base_rest[n]+bonus)/100+1e-10) for i,v in enumerate(vals)]
cases=[
(1,'T',(1008,472,84)),(2,'I',(949,480,84)),
(4,'OSKWGA',(6860,3282,716)),(6,'ONSKWU',(6805,3297,704)),
(7,'ONSKW',(5451,2623,544)),(8,'OSKW',(3862,1846,349)),
(9,'SKW',(2454,1177,183)),(10,'SW',(1267,611,61)),
(11,'W',(302,150,0)),(13,'H',(372,186,31)),(14,'S',(812,387,55)),
(15,'T',(1008,472,84)),(16,'TB',(1387,657,113)),
(17,'TBN',(2470,1187,217)),(18,'TBNW',(3151,1521,258)),
(19,'TBNG',(3539,1703,342)),(20,'TBNGU',(4494,2182,452)),
(21,'TBNGUH',(5791,2821,613)),(22,'IT',(2054,999,179)),
(23,'ITN',(3206,1564,292)),(24,'ITNG',(4391,2140,431)),
(25,'ITNGU',(5472,2683,561)),(26,'ITNGUH',(6926,3402,746)),
]
def verify():
    results=[]
    for idx,keys,obs in cases:
     calc=prediction(keys)
     results.append((idx,keys,obs,calc[:3],[a==b for a,b in zip(obs,calc[:3])]))
     print(f'{idx:02} {keys:<7} obs={obs}, calc={tuple(calc[:3])} {"MATCH" if tuple(calc[:3])==obs else "DIFFERENT"}')
    print('Matched',sum(all(m) for _,_,_,_,m in results),'/',len(results))
    print('Rows not matched',[(idx,keys,obs,calc) for idx,keys,obs,calc,m in results if not all(m)])
    # Full 11-ability match of two independent six-god series.
    obs26=[6926,3402,746,772,655,799,975,733,740,602,694]
    
    full_cases={
    6:('ONSKWU',[6805,3297,704,837,551,751,831,684,605,551,578]),
    21:('TBNGUH',[5791,2821,613,627,501,600,752,528,554,521,541]),
    26:('ITNGUH',[6926,3402,746,772,655,799,975,733,740,602,694]),
    }
    for idx,(keys,obs) in full_cases.items():
     calc=prediction(keys)
     print('all11', idx, 'MATCH' if calc==obs else 'MISMATCH', 'observed',obs,'predicted',calc)

if __name__=="__main__":verify()
