import numpy as np, wave, sys
D=float(sys.argv[1]); bpm=float(sys.argv[2]); out=sys.argv[3]; seed=int(sys.argv[4]); key=float(sys.argv[5])
SR=44100;N=int(SR*D);L=np.zeros(N);R=np.zeros(N);rng=np.random.default_rng(seed);beat=60/bpm;bar=4*beat
tt=lambda d:np.arange(int(SR*d))/SR
def add(buf,sig,t,g):
    i=int(t*SR);j=min(N,i+len(sig))
    if 0<=i<N: buf[i:j]+=sig[:j-i]*g
def both(sig,t,g=1.0,pan=0.0): add(L,sig,t,g*(1-max(0,pan)));add(R,sig,t,g*(1+min(0,pan)))
def kick():
    t=tt(.35);f=48+80*np.exp(-t*30);return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)*.9
def snap():
    t=tt(.2);n=rng.standard_normal(len(t));return np.convolve(n,[1,-1],'same')*np.exp(-t*24)*.22
def hat():
    t=tt(.08);n=np.diff(np.concatenate([[0],rng.standard_normal(len(t))]));return n*np.exp(-t*60)*.08
def pluck(f,d=.5):
    t=tt(d);s=np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*2*f*t)+.15*np.sin(2*np.pi*3*f*t);return s*np.exp(-t*6)*np.minimum(1,t*200)*.16
def bass(f,d):
    t=tt(d);s=np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*2*f*t);return s*np.minimum(1,t*60)*np.exp(-t*2)*.32
def pad(fr,d):
    t=tt(d);s=sum(np.sin(2*np.pi*f*t+np.sin(2*np.pi*.2*t)*.5)+.25*np.sin(2*np.pi*f*2.004*t) for f in fr)/len(fr)
    return s*np.minimum(1,t/1.0)*np.minimum(1,(d-t)/1.0)*.18
def swell(d):
    t=tt(d);n=rng.standard_normal(len(t));n=np.convolve(n,np.ones(30)/30,'same');return n*np.linspace(0,1,len(t))**2*.35
k=key  # tônica
prog=[[k,k*1.25,k*1.5],[k*0.8909,k*1.1225,k*1.3348],[k*0.75,k*0.9439,k*1.1225],[k*0.8409,k*1.0,k*1.2599]]
roots=[k/2,k*0.8909/2,k*0.75/2,k*0.8409/2]
t0=0;i=0
while t0<D: both(pad(prog[i%4],min(bar,D-t0)+.05),t0);t0+=bar;i+=1
start=2*bar; end=D-bar*1.5
nb=int((D)/beat)
for b in range(nb):
    t=b*beat; ch=int(t/bar)%4
    if t>=beat*2: both(pluck(prog[ch][b%3]*2,.45),t,.9,(-.35 if b%2 else .35))
    if start<=t<end:
        both(kick(),t)
        if b%2==1: both(snap(),t,1,-.1)
        both(hat(),t+beat/2,.9,.25)
        both(bass(roots[ch],beat*.9),t)
both(swell(bar),start-bar)
mix=np.stack([L,R],1);fi=int(.4*SR);fo=int(2.0*SR);mix[:fi]*=np.linspace(0,1,fi)[:,None];mix[-fo:]*=np.linspace(1,0,fo)[:,None]
mix=np.tanh(mix*1.1);mix/=np.max(np.abs(mix))*1.15
w=wave.open(out,'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes());w.close()
print('ok',out)
