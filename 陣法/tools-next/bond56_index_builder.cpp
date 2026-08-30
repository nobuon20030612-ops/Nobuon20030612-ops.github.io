#include <bits/stdc++.h>
using namespace std;
struct Mask{uint64_t lo=0,hi=0; bool operator==(Mask const&o)const{return lo==o.lo&&hi==o.hi;}};
struct MaskHash{size_t operator()(Mask const&m)const noexcept{return hash<uint64_t>()(m.lo^(m.hi*0x9e3779b97f4a7c15ULL));}};
static inline Mask mor(Mask a,Mask b){return {a.lo|b.lo,a.hi|b.hi};}
static inline Mask mor3(Mask a,Mask b,Mask c){return {a.lo|b.lo|c.lo,a.hi|b.hi|c.hi};}
static inline int mpc(Mask a){return __builtin_popcountll(a.lo)+__builtin_popcountll(a.hi);}
static inline bool mless(Mask a,Mask b){return a.hi!=b.hi?a.hi<b.hi:a.lo<b.lo;}
struct Hero{bool ex=false;array<uint16_t,4> f{};uint8_t nf=0; bool has(uint16_t x)const{for(int i=0;i<nf;i++)if(f[i]==x)return true;return false;}};
struct RawT{uint16_t a,b,c;Mask m;};
struct T{uint16_t a,b,c,m;};
struct GM{uint16_t a,b,m,mid;};
struct G{uint16_t a,b,m,c;uint32_t off;};

template<class Tn> static void wr(ofstream&f,Tn v){f.write(reinterpret_cast<const char*>(&v),sizeof(v));}
static void headerSkeleton(ofstream&f,uint8_t type,uint8_t cnt){f.write("B56S",4);uint16_t v=2;wr(f,v);wr(f,type);wr(f,cnt);uint64_t n=0;wr(f,n);} 
static void patchCount(ofstream&f,uint64_t n){auto pos=f.tellp();f.seekp(8);wr(f,n);f.seekp(pos);} 

int main(int argc,char**argv){
 if(argc<3){cerr<<"usage: builder input.txt outdir\n";return 2;}
 ifstream in(argv[1]); if(!in){cerr<<"input open failed\n";return 2;}
 int H,B,F; in>>H>>B>>F; vector<Hero> heroes(H+1); 
 for(int i=0;i<=H;i++){int id,ex,nf;in>>id>>ex>>nf;heroes[id].ex=ex;heroes[id].nf=nf;for(int k=0;k<4;k++){int x;in>>x;heroes[id].f[k]=x;}}
 vector<array<uint16_t,3>> bonds(B+1);for(int i=1;i<=B;i++){int id,a,b,c;in>>id>>a>>b>>c;bonds[id]={(uint16_t)a,(uint16_t)b,(uint16_t)c};}
 string out=argv[2];filesystem::create_directories(out);
 cerr<<"heroes="<<H<<" bonds="<<B<<" factors="<<F<<"\n";
 // Build nonzero triple masks in hero-id order. For each pair, precompute bonds satisfiable by a,b and each needed factor for c.
 vector<RawT> raw;raw.reserve(800000);unordered_set<Mask,MaskHash> maskset;maskset.reserve(2048);
 for(int a=1;a<=H;a++)if(heroes[a].ex){
  for(int b=a+1;b<=H;b++)if(heroes[b].ex){
   vector<Mask> need(F+1);
   for(int bid=1;bid<=B;bid++){
    auto r=bonds[bid]; int bit=bid-1; Mask bm; if(bit<64)bm.lo=1ULL<<bit;else bm.hi=1ULL<<(bit-64);
    for(int ia=0;ia<3;ia++)for(int ib=0;ib<3;ib++)if(ib!=ia){int ic=3-ia-ib;if(ic<0||ic>2||ic==ia||ic==ib)continue;if(heroes[a].has(r[ia])&&heroes[b].has(r[ib]))need[r[ic]]=mor(need[r[ic]],bm);}
   }
   for(int c=b+1;c<=H;c++)if(heroes[c].ex){Mask m;for(int k=0;k<heroes[c].nf;k++){uint16_t f=heroes[c].f[k];if(f<=F)m=mor(m,need[f]);}if(m.lo||m.hi){raw.push_back({(uint16_t)a,(uint16_t)b,(uint16_t)c,m});maskset.insert(m);}}
  }
 }
 vector<Mask> masks(maskset.begin(),maskset.end());sort(masks.begin(),masks.end(),mless);unordered_map<Mask,uint16_t,MaskHash> mid;mid.reserve(masks.size()*2);for(uint16_t i=0;i<masks.size();i++)mid[masks[i]]=i;
 vector<T> triples;triples.reserve(raw.size());vector<GM> gms;gms.reserve(raw.size()*3);
 for(auto&r:raw){uint16_t m=mid[r.m];triples.push_back({r.a,r.b,r.c,m});gms.push_back({r.a,r.b,m,r.c});gms.push_back({r.a,r.c,m,r.b});gms.push_back({r.b,r.c,m,r.a});}
 sort(gms.begin(),gms.end(),[](GM const&x,GM const&y){return tie(x.a,x.b,x.m,x.mid)<tie(y.a,y.b,y.m,y.mid);});
 vector<G> groups;groups.reserve(120000);vector<uint16_t> mids;mids.reserve(gms.size());
 for(size_t i=0;i<gms.size();){size_t j=i+1;while(j<gms.size()&&gms[j].a==gms[i].a&&gms[j].b==gms[i].b&&gms[j].m==gms[i].m)j++;G g{gms[i].a,gms[i].b,gms[i].m,(uint16_t)(j-i),(uint32_t)mids.size()};groups.push_back(g);for(size_t k=i;k<j;k++)mids.push_back(gms[k].mid);i=j;}
 // core
 {ofstream f(out+"/bond56_core.bin",ios::binary);f.write("B56I",4);uint32_t v=2;wr(f,v);wr(f,(uint32_t)H);wr(f,(uint32_t)masks.size());wr(f,(uint32_t)groups.size());wr(f,(uint32_t)mids.size());wr(f,(uint32_t)triples.size());for(auto&m:masks){wr(f,m.lo);wr(f,m.hi);}for(auto&g:groups){wr(f,g.a);wr(f,g.b);wr(f,g.m);wr(f,g.c);wr(f,g.off);}for(auto x:mids)wr(f,x);for(auto&t:triples){wr(f,t.a);wr(f,t.b);wr(f,t.c);wr(f,t.m);}}
 cerr<<"core masks="<<masks.size()<<" groups="<<groups.size()<<" mids="<<mids.size()<<" triples="<<triples.size()<<"\n";
 // pair -> group IDs. Groups are sorted by a,b,m.
 int N=H+1;vector<vector<uint32_t>> pg((size_t)N*N);for(uint32_t gi=0;gi<groups.size();gi++)pg[(size_t)groups[gi].a*N+groups[gi].b].push_back(gi);
 auto pairGroups=[&](int a,int b)->vector<uint32_t>&{if(a>b)swap(a,b);return pg[(size_t)a*N+b];};
 // Bondset IDs use deterministic first occurrence from skeleton build order.
 unordered_map<Mask,uint32_t,MaskHash> bsmap;bsmap.reserve(400000);vector<Mask> bsets;bsets.reserve(400000);
 auto bsid=[&](Mask m)->uint32_t{auto it=bsmap.find(m);if(it!=bsmap.end())return it->second;uint32_t id=bsets.size();bsets.push_back(m);bsmap.emplace(m,id);return id;};
 auto writeCycle3=[&](int target){string fn=out+"/cycle3_c"+to_string(target)+".bin";ofstream f(fn,ios::binary);headerSkeleton(f,3,target);uint64_t n=0;for(int A=1;A<=H;A++)for(int C=A+1;C<=H;C++){auto&l1=pairGroups(A,C);if(l1.empty())continue;for(int E=C+1;E<=H;E++){auto&l2=pairGroups(C,E);auto&l3=pairGroups(A,E);if(l2.empty()||l3.empty())continue;for(auto g1:l1)for(auto g2:l2)for(auto g3:l3){Mask u=mor3(masks[groups[g1].m],masks[groups[g2].m],masks[groups[g3].m]);if(mpc(u)!=target)continue;wr(f,g1);wr(f,g2);wr(f,g3);wr(f,bsid(u));n++;}}}patchCount(f,n);cerr<<"cycle3 c"<<target<<"="<<n<<"\n";};
 auto writeCycle2=[&](int target){
  string fn=out+"/cycle2_c"+to_string(target)+".bin";
  ofstream f(fn,ios::binary); headerSkeleton(f,2,target); uint64_t n=0;
  for(int C=1;C<=H;C++){
   for(int A=1;A<=H;A++) if(A!=C){
    auto &l1=pairGroups(A,C); if(l1.empty()) continue;
    for(int E=A+1;E<=H;E++) if(E!=C){
     auto &l2=pairGroups(C,E); if(l2.empty()) continue;
     for(auto g1:l1) for(auto g2:l2){
      Mask u=mor(masks[groups[g1].m],masks[groups[g2].m]);
      if(mpc(u)!=target) continue;
      wr(f,g1); wr(f,g2); wr(f,bsid(u)); n++;
     }
    }
   }
  }
  patchCount(f,n); cerr<<"cycle2 c"<<target<<"="<<n<<"\n";
 };
 auto writeDis=[&](int target){string fn=out+"/disjoint_c"+to_string(target)+".bin";ofstream f(fn,ios::binary);headerSkeleton(f,4,target);uint64_t n=0;for(uint16_t i=0;i<masks.size();i++)for(uint16_t j=i;j<masks.size();j++){Mask u=mor(masks[i],masks[j]);if(mpc(u)!=target)continue;wr(f,i);wr(f,j);wr(f,bsid(u));n++;}patchCount(f,n);cerr<<"disjoint c"<<target<<"="<<n<<"\n";};
 // Match historical generation order enough to keep bondset IDs compact for gzip.
 writeCycle3(5);writeCycle3(6);writeCycle2(5);writeCycle2(6);writeDis(5);writeDis(6);
 {ofstream f(out+"/bondsets.bin",ios::binary);f.write("B56B",4);uint32_t v=1;wr(f,v);wr(f,(uint32_t)bsets.size());for(auto&m:bsets){wr(f,m.lo);wr(f,m.hi);}}
 cerr<<"bondsets="<<bsets.size()<<"\n";
 return 0;
}
