# Creator HQ

[Runtime URL parola düzeltme yardımcısı](#runtime-url-parola-düzeltme-yardımcısı)

[English](README.md) | [Türkçe](README.tr.md)

Creator HQ; etkileşimli 3D ofis, ajan profilleri, PostgreSQL görev panosu, insan onayları ve belirli şablonlarla hazırlanan CEO raporları sunan yerel öncelikli bir uygulamadır. Bu sürüm yayımlanmış bir açık kaynak sürümü değil, yayın incelemesine hazırlanan temeldir.

## Güncel veritabanı durumu

Çalışan kurulum Supabase PostgreSQL kullanıyor. Phase 1.3 kaynak adayı atomik görev işlemleri, eşzamanlı Done koruması, sınırlı health bütçesi ve SQLite dosyası olmadan PostgreSQL açılışı getirir. Yerel paket canlıya ayrıca onay verilmeden uygulanmaz.

[Yeni bilgisayarda PostgreSQL kurulumu](docs/postgresql-installation.md) · [Phase 1.2 doğrulaması](docs/phase12-cutover-completed.md)

## Kurulum

Windows 11, Node.js 24+ ve npm gerekir. Projeyi indirdiğiniz dizinde:

```powershell
npm ci
# Önce özel API/web ortam dosyalarını güvenli biçimde yapılandırın.
npm run build
npm start
```

Uygulama: [Creator HQ](http://127.0.0.1:3000). Durdurmak için Ctrl+C. Geliştirmede son iki komut yerine `npm run dev` kullanın. Build ve geliştirme sunucusunu eşzamanlı çalıştırmayın.

Mevcut Supabase projesine bağlanırken db:setup, db push, seed veya migration çalıştırmayın. SQLite yalnızca açıkça seçilen eski kurulum ve izole test desteğidir; kaynak dosyalar ve yedekler korunur.

## Kişisel ve açık kaynak dağıtımı

Kişisel dağıtım varsayılan olarak Türkçedir. Açık kaynak kurulumu için `apps/web/.env.local` dosyasına aşağıdaki ayarı ekleyip yeniden derleyin:

```dotenv
NEXT_PUBLIC_DEPLOYMENT_MODE=public
```

`public` ayarında desteklenen ilk tarayıcı dili tercih edilir; Türkçe/İngilizce eşleşmesi yoksa İngilizce kullanılır. `personal` ayarı Türkçe varsayılanı korur. Önceden kaydedilmiş geçerli TR / EN tercihi her iki ayarın da önündedir; sahibin Türkçe tercihi değiştirilmez. Proje sahibiyle Codex iletişimi Türkçe kalır.

Örnekler `apps/api/.env.example` ve `apps/web/.env.example` içindedir. Gerçek ayarlar ilgili çalışma alanının `.env` / `.env.local` dosyasına konur; var olan dosyaları ezmeyin. `NEXT_PUBLIC_` değerleri tarayıcıya açıktır, bu alanlara kimlik bilgisi veya paylaşılan derlemelerde kişisel yol koymayın.

Stüdyo içerik dili arayüzden bağımsızdır: Niko İngilizce, Son Yedek Türkçe varsayılanına sahiptir. Dil değiştirmek görevleri, senaryoları, anlatımı veya kasa belgelerini çevirmez. Gerçek Codex çalıştırması, yayınlama, Remotion ve Obsidian bağlantıları kapalıdır.

## Doğrulama ve güvenlik

```powershell
npm run typecheck
npm test
npm run build
npm run audit:public
```

Yayın denetimi; hassas dosyaları, yaygın kimlik bilgisi kalıplarını ve makineye özel yolları arar. Manuel dosya ve Git geçmişi incelemesinin yerini tutmaz. Önceki bağımlılık güvenlik bulguları ayrıca değerlendirilmelidir. Yayınlama, görünürlük değişikliği ve lisans kararı yalnızca açık operatör onayıyla yapılabilir.

[English README](README.md) · [Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md) · [Migration plan](docs/migration-plan.md) · [Verification](docs/readiness-verification.md)

## Canlı Supabase geçişi için operatör adımları

1. Yalnızca mevcut `creator-hq` projesini açın. Yeni proje oluşturmayın; kapalı Data API'yi yeniden açmayın. Mevcut ayarı dashboard üzerinde ayrıca doğrulayın.
2. [Geçiş belgesindeki](docs/database-migration.md) rol SQL'ini inceleyin. `creator_hq_runtime` rolü yönetici/BYPASSRLS/rol üyeliği yetkileri taşımamalıdır. Parolayı güvenli yerel `psql` oturumundaki etkileşimli `\password` komutuyla ayarlayın; sohbete veya sürüm kontrollü dosyaya yazmayın.
3. Git dışında tutulan `apps/api/.env.migration` dosyasında `DATABASE_URL`, `DIRECT_URL` ve `SUPABASE_PROJECT_REF` alanlarını doldurun. Connect penceresindeki gerçek bağlantıyı kullanın; pooler adresini tahmin etmeyin. Runtime bağlantısı kısıtlı rolü kullanır; migration bağlantısı yalnızca backend bakım aracına aittir.
4. Prisma 6 bağlantı parametreleri: `schema=creator_hq`, `sslmode=require`, `sslaccept=strict`, `connect_timeout=10`, `pool_timeout=10`, `socket_timeout=20`, `connection_limit=5`. Migration bağlantısı doğrudan veya session pooler üzerinden port `5432` kullanmalıdır. Gerekirse dashboard kök sertifikasını özel bir yerel konumda saklayıp `sslrootcert` ayarlayın.
5. [Resmî PostgreSQL Windows dağıtımından](https://www.postgresql.org/download/windows/) uyumlu `pg_dump`, `pg_restore` ve `psql` araçlarını temin edin. Gerekirse `PG_DUMP_BIN` / `PG_RESTORE_BIN` yollarını özel ortam dosyasında ayarlayın. Uygulama sistem hizmeti veya zamanlanmış yedek işi kurmaz.
6. Önce bağlantı/izin ön kontrolü yapılır. Şema, rollback-only yazma testi ve veri aktarımı için ilgili onay bayrakları yalnızca incelemeden sonra açılır. Kaynak yazmaları durdurulup güncel SQLite yedeği alınmadan aktarım yapılmaz. **Canlı uygulama geçişi, gerçek veri doğrulamasından sonra ayrıca açık onay gerektirir.**

```powershell
npm run db:migrate -- --preflight
npm run db:backup:postgres -- --check-tools
```

Kimlik bilgileri eksikse bu komutların güvenli biçimde durması beklenir; bu sonuç başarılı Supabase bağlantısı anlamına gelmez. Çalışan `apps/api/.env` dosyasını hazırlık sırasında PostgreSQL'e çevirmeyin.

## Supabase bağlantı ve rol hazırlığı

**Güncel güvenlik bekletmesi:** Önce aşağıdaki “Son SQL güvenlik kontrolü” bölümünü okuyun. Canlı SQL, parola ve LOGIN için mevcut onay yoktur. Önceki adımları çalıştırma talimatı olarak değerlendirmeyin.

Bu bölüm yalnızca hazırlıktır. Canlı SQL, rol/parola değişikliği, veri aktarımı ve uygulama geçişi yapılmadı; migration onayları false kalır. [İngilizce teknik rehber](docs/supabase-access.md).

1. Supabase Dashboard içinde mevcut creator-hq projesini açın. **Project Settings → General** bölümünden Project Reference değerini kontrol edin; görünen proje adı referans değildir. Üstteki **Connect → Session Pooler** bölümünde 5432 bağlantısını seçin. Host değerini aynen alın; bölgeden tahmin etmeyin. Data API kapalı kalsın; creator_hq şemasını API erişimine eklemeyin.
2. Çalıştırmadan önce apps/api/prisma/postgresql/security/bootstrap-role.sql ve prepare-schema.sql dosyalarını inceleyin. Ayrıca migrations/20261106000100_phase12_initial/migration.sql dosyasındaki tablo, RLS ve yetkileri gözden geçirin. Son dosya bu hazırlıkta çalıştırılmayacak; gelecekte Prisma üzerinden uygulanacak.
3. **Açık onayınızdan sonra**, SQL Editor içinde aynı yönetici rolüyle önce bootstrap-role.sql, sonra prepare-schema.sql çalıştırılabilir. Bunlar NOLOGIN çalışma rolü ve özel şema hazırlar; uygulama tablolarını oluşturmaz. Var olan rolün yetkileri veya şemanın sahibi beklenenden farklıysa otomatik düzeltmeyin. Canlı ortamda bu dosyaları ben çalıştırmadım.
4. Parola ve LOGIN kurulumu da ayrı onay gerektirir. Yerel psql istemcisinde yönetici olarak, parola argümana yazılmadan -W istemiyle ve sslmode=verify-full kullanarak bağlanın. Etkileşimli oturumda önce \password creator_hq_runtime komutuyla yalnızca bu role ait güçlü parola belirleyin; ardından ALTER ROLE creator_hq_runtime LOGIN; çalıştırın. Parolayı SQL Editor sorgusuna, komut satırına veya sohbete yazmayın. psql, pg_dump ve pg_restore PATH üzerinde bulunamadı; gerekirse [resmî PostgreSQL Windows kaynağından](https://www.postgresql.org/download/windows/) istemci araçlarını sağlayın. Yerel veritabanı servisi kurmak gerekmez.
5. Git dışındaki apps/api/.env.migration dosyasını yerelde düzenleyin. DATABASE_URL için Session Pooler kullanıcısı creator_hq_runtime.PROJECT_REF ve **çalışma rolünün parolası**; DIRECT_URL için postgres.PROJECT_REF ve **yönetici veritabanı parolası** kullanılır. İkisinde de aynı dashboard pooler hostu, 5432 portu ve postgres veritabanı bulunur. SUPABASE_PROJECT_REF alanına yalnızca gerçek referansı girin. PROJECT_REF burada bir açıklamadır; olduğu gibi kopyalanacak değer değildir. Supabase API anahtarı bu parolaların yerine geçmez. Çalışan apps/api/.env dosyasını değiştirmeyin.
6. Her iki Prisma URL'sine şu parametreleri ekleyin: schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5. Parolanın özel karakterlerini yalnızca yerelde URL kodlamasıyla işleyin. Gerekirse Database Settings → SSL Configuration üzerinden güvenilir sertifikayı alıp sslrootcert parametresine yerel, URL kodlanmış mutlak yolunu verin. TLS hatasında doğrulamayı kapatmayın. Seçtiğiniz Session Pooler için 6543 veya pgbouncer=true kullanmayın. DIRECT_URL adı burada IPv6 zorunluluğu getirmez; 5432 Session Pooler desteklenir. Ayrıntılı parametreler İngilizce rehberdedir.
7. Onaylı rol kurulumu ve yerel yapılandırma tamamlanınca temiz bir PowerShell oturumunda, proje kökünden aşağıdaki salt okunur kontrolü çalıştırın. Terminalde önceden tanımlanmış DATABASE_URL/DIRECT_URL değişkenleri yerel dosyayı geçersiz kılabilir; değerleri ekrana dökmeyin.

~~~powershell
npm run db:migrate -- --check-connection
~~~

Kontrol, şema tabloları kurulmadan da çalışır; iki rolün kimliğini ve çalışma rolünün kalıcı DDL/migration yetkilerinin bulunmadığını sorgular. Kayıt yazmaz, onay bayrağı açmaz, uygulamayı PostgreSQL'e geçirmez. Genel veritabanı CREATE veya kullanıcı şemalarında CREATE yetkisi varsa durur; PUBLIC üzerinden gelen yetkileri tüm proje için otomatik iptal etmeyin, ayrı inceleyin. Geçici tablo oluşturma izni PUBLIC üzerinden kalabilir. Yalnızca bağlantı kontrolü, canlı yazma/geri yükleme testinin veya tam güvenlik incelemesinin yerine geçmez.

Çalışma rolü yalnızca creator_hq şema USAGE ve gelecekte kurulacak 10 uygulama tablosunda SELECT/INSERT/UPDATE/DELETE alır. Şema/tablo sahipliği, kalıcı CREATE, rol yönetimi, BYPASSRLS, üst rol üyeliği ve Prisma migration geçmişine erişim verilmez. Eski genel tablo yetkisi canlı uygulamadan önce açık tablo listesine daraltıldı. Başka bir ortamda eski migration uygulanmışsa checksum'u değiştirmeyin; ayrı ileri düzeltme planı gerekir. RLS tek backend rolüne tüm uygulama satırlarını açar; kullanıcılar arası yetkilendirme sistemi değildir.

MIGRATION_SCHEMA_APPROVED, MIGRATION_DATA_APPROVED, MIGRATION_PROBE_APPROVED ve MIGRATION_SOURCE_FROZEN false kalmalı. Bu aşamada --apply-schema, --apply-data, --probe-write çalıştırmayın; aktif sağlayıcı SQLite olarak korunur. Canlı rol/şema, parola/LOGIN, sonraki veri aktarımı ve uygulama geçişi için ayrıca açık onay gerekir.

Bu hazırlığın doğrulaması: typecheck başarılı; 7 veritabanı hazırlık/migration testi ve 5 kök güvenlik/politika testi geçti. Public audit 76 aday dosyada bulgu vermedi. Git'te henüz izlenen dosya yok; özel ortam dosyaları Git dışında. Üç bağlantı alanı boş ve dört onay/dondurma bayrağı false kaldı. Canlı Supabase bağlantısı/yetkileri ve Data API dashboard ayarı doğrulanmadı. Uygulama yeniden derlenmedi/başlatılmadı; yerel sağlık isteği bu kontrolde erişilebilir değildi. Önceki Prisma geliştirme araçları güvenlik bulguları giderilmiş sayılmaz; bu görevde yeni online npm audit yapılmadı.

## Son SQL güvenlik kontrolü

**Canlı SQL yürütme, parola oluşturma, LOGIN ve veri aktarımı için onay yoktur.** Bu inceleme yalnızca yerel dosyaları güncelledi; Supabase'e bağlanılmadı. Python kullanılmadı. [İngilizce ayrıntılı rapor](docs/supabase-sql-review.md).

- Önceki şema kapsamlı varsayılan izin iptalleri global yetkileri gideremiyordu. Global tablo/sequence/şema varsayılanlarında başka alıcılara verilmiş izin varsa prepare-schema.sql artık GLOBAL_DEFAULT_ACL_REVIEW_REQUIRED ile durur. Global Supabase varsayılanları değiştirilmez.
- Fonksiyonların yerleşik global PUBLIC EXECUTE yetkisi ayrıca raporlanır; şema kapsamlı REVOKE bunu kaldırmaz. Mevcut migration fonksiyon/procedure veya sequence oluşturmaz. Gelecekte fonksiyon eklenirse sahibi, SECURITY DEFINER, search_path ve nesneye özel izinler aynı oluşturma transaction'ında ayrıca incelenmelidir. Paylaşılan yönetici rolünün global fonksiyon izinleri otomatik değiştirilmez.
- bootstrap-role.sql mevcut onaysız LOGIN/yönetici bayrağı veya iki yönde üyelik bulursa mevcut rolü düzeltmeden durur. prepare-schema.sql ayrıca kalıcı CREATE, sahiplik, mevcut nesneler, beklenmeyen şema ACL'leri ve şema varsayılanları için durur. Boş bir mevcut tablo veya yalnızca Prisma geçmişi bulunması da ayrı inceleme gerektirir.
- Salt okunur apps/api/prisma/postgresql/security/inspect-security.sql; rol bayraklarını/üyelikleri, nesne sahiplerini, etkili tablo/sequence/function izinlerini, RLS, kolon izinlerini, global ve şema kapsamlı varsayılanları gösterir. Çıktılar özel tutulmalıdır; parola katalogları veya rol ayarlarının gizli değerleri sorgulanmaz.
- Salt okunur inspect-existing-data.sql; fiziksel tablolarda yalnızca kesin kayıt sayıları üretir, satır içeriği göstermez. NOTICE mesajlarının istemcide görünür olması gerekir. Yetki/RLS nedeniyle sayı alınamaması sıfır değildir; COUNT_UNVERIFIED olarak belirtilir. Partition üst tabloları fiziksel olarak sıfır olabilir; yerel partition'lar ayrı sayılır. View/foreign tablolar taranmaz. Çıktıda mevcut veri varsa ayrı inceleme gerekir, otomatik silme/aktarma yapılmaz.
- Bu iki inceleme dosyası da canlıda çalıştırılmadı; çalıştırılması için ayrıca açık onay gerekir. anon, authenticated, service_role ve sistem rollerinin mevcut işlevleri otomatik değiştirilmez. Mevcut migration dosyası bu son kontrolde değiştirilmedi. Aynı yönetici sahibi kullanılmalı; uygulama tabloları ileride yalnızca onaylı Prisma migration süreciyle oluşturulmalıdır.

Yerel doğrulama: 10 veritabanı hazırlık/migration/güvenlik testi ve 5 kök güvenlik/politika testi geçti; typecheck başarılı. Public audit 80 aday dosyada bulgu vermedi. Yeni salt okunur SQL'in son sürümü ayrıca izole SQL motorunda test edildi. Uygulama yeniden derlenmedi veya yeniden başlatılmadı; canlı roller, izinler ve mevcut Supabase verileri henüz bilinmiyor. Migration onayları false kalır.

### SQL Editor ilk kurulum uyumluluk bekletmesi

Son yeniden kontrolde, süper kullanıcı olmayan CREATEROLE yöneticisinin PostgreSQL 16+ üzerindeki otomatik yönetim üyeliği izole ortamda yeniden üretildi. Güncel bootstrap-role.sql bu üyeliği de reddediyor ve rol oluşturmayı geri alıyor; prepare-schema.sql de aynı sıkı üyelik şartını uyguluyor. Önceki süper kullanıcı testleri bu hosted uyumluluğu kanıtlamıyordu. Bu nedenle sunucu sürümü ve postgres rol bayrakları doğrulanmadan dosyalar çalıştırılabilir ilk kurulum olarak sunulmamalıdır. Koruma kaldırılmadı; sistem üyeliklerine dokunulmadı. Ayrıca prepare-schema.sql yalnızca CREATE SCHEMA içermez: USAGE ve şema kapsamlı varsayılan izin işlemleri de içerir. Yalnızca rol ve boş şema oluşturma kapsamı için bunlar ayrıca değerlendirilmelidir. Canlı SQL, LOGIN/parola veya veri aktarımı yapılmadı.

## Parola, LOGIN ve bağlantı hazırlığı

**Güncel durum:** PostgreSQL 17.11 üzerinde NOLOGIN rolü ve boş şema kurulumu sizin tarafınızdan doğrulandı. Otomatik yönetim üyeliği beklenen biçimde; şema sahibi postgres, runtime USAGE=true / CREATE=false, tablo ve rutin sayısı sıfır. Bu bilgi operatör doğrulamasıdır; Codex canlı bağlantı yapmadı. Önceki kurulum bekletmeleri tarihsel açıklamalardır. [Güncel İngilizce bağlantı planı](docs/supabase-connection-plan.md).

**Aşağıdaki bağlantı/parola/LOGIN adımları henüz çalıştırılmayacak plandır.** Her canlı işlem ayrıca açık onay gerektirir. Kurulum betikleri değişmedi; parola üretilmedi, LOGIN açılmadı, veri aktarımı yapılmadı.

1. **Windows istemcileri:** [Resmî PostgreSQL Windows sayfasından](https://www.postgresql.org/download/windows/) EDB kurucusuna gidin. Sunucunuzla aynı ana sürüm olan PostgreSQL 17'nin sunulan güncel Windows x64 istemci paketini seçin. İndirilen kurucunun geçerli dijital imzasını ve yayıncısını kontrol edin. Select Components ekranında yalnızca **Command Line Tools** seçili kalsın; Server, pgAdmin ve Stack Builder seçilmesin. Yerel veritabanı servisi veya cluster oluşturmayın. Gerçek bir yalnızca-istemci seçeneği yoksa kurulumu durdurun; resmî sayfanın yönlendirdiği tam bağımlılıklı binary ZIP seçeneği ayrıca incelenebilir. Bu görevde hiçbir araç indirilmedi/kurulmadı.
2. **Araçları kontrol edin:** Kurulumdan sonra, PATH'i sistem genelinde değiştirmek yerine tam yollar kullanılabilir. Aşağıdakiler yalnızca yerel sürüm kontrolüdür:

~~~powershell
$pgToolsDirectory = Read-Host 'PostgreSQL 17 bin klasörü'
$pgClient = Join-Path $pgToolsDirectory 'psql.exe'
$pgDumpClient = Join-Path $pgToolsDirectory 'pg_dump.exe'
$pgRestoreClient = Join-Path $pgToolsDirectory 'pg_restore.exe'
& $pgClient --version
& $pgDumpClient --version
& $pgRestoreClient --version
~~~

3. **TLS hazırlığı:** Mevcut projenin Connect → Session Pooler ekranından gerçek hostu ve proje referansını alın. Port 5432, veritabanı postgres olacak. Gerekli güvenilir CA sertifikasını Database Settings / SSL Configuration bölümünden alın. Hostu tahmin etmeyin; sertifika hatasında doğrulamayı kapatmayın. Yeni, kayıt/transcript/debug çıktısı almayan güvenli yerel terminal kullanın. Merkezi güvenlik kayıtlarını kapatmayın; güvenli giriş mümkün değilse işlemi durdurun. Önceden tanımlanmış PGOPTIONS/PGPASSWORD/PGSERVICE/PGPASSFILE değerleri bağlantıyı etkileyebilir; değerlerini ekrana dökmeyin.

~~~powershell
$poolerHost = Read-Host 'Dashboard Session Pooler hostu'
$projectReference = Read-Host 'Proje referansı'
$caCertificate = Read-Host 'Güvenilir CA sertifikasının mutlak yolu'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = $caCertificate
$env:PGCONNECT_TIMEOUT = '10'
$administrativeUser = 'postgres.' + $projectReference
~~~

4. **Parola ataması — ayrıca onaydan sonra:** Aşağıdaki yönetici bağlantısı mevcut yönetici parolasını gizli istemde sorar; parola argümana yazılmaz. -X başlangıç dosyalarını yüklemez, HISTFILE=NUL psql geçmişini Windows'ta saklamaz. Parola içeren URI, PGPASSWORD, log dosyası veya SQL Editor sorgusu kullanmayın.

~~~powershell
& $pgClient -X -W -v 'HISTFILE=NUL' -v 'ON_ERROR_STOP=1' -v 'ECHO=none' -v 'ECHO_HIDDEN=off' -h $poolerHost -p 5432 -U $administrativeUser -d postgres
~~~

psql içinde önce \conninfo ve SELECT current_user, current_database(); ile hedefi doğrulayın. Sonuç postgres / postgres olmalı. Yönetici parolasını değiştirmeyin. Güvenilir yerel parola yöneticisinde runtime için benzersiz, rastgele, en az 32 karakterlik parola oluşturun ve orada saklayın. Ardından, yalnızca parola değişikliği onaylandıysa:

~~~text
SET password_encryption = 'scram-sha-256';
\password creator_hq_runtime
~~~

Parolayı yalnızca iki gizli isteme girin. SET yalnızca bu oturumu etkiler. \password, düz metin parolayı SQL geçmişine ve normal sunucu sorgu loguna koymadan şifrelenmiş biçimde gönderir. Verifier/hash veya debug kayıtları da hassastır; hata araştırırken gizli değerleri yazdırmayın. Beklenen yanıt ALTER ROLE. Hata olursa durun; LOGIN kapalı kalsın. Bu komut LOGIN açmaz.

5. **LOGIN — ayrı onaydan sonra:** Başarılı parola atamasından ve açık LOGIN onayından sonra aynı güvenilir yönetici oturumunda:

~~~sql
ALTER ROLE creator_hq_runtime LOGIN;
SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolinherit, rolbypassrls, rolreplication
FROM pg_roles WHERE rolname = 'creator_hq_runtime';
~~~

Yalnızca rolcanlogin=true, diğer altı bayrak false olmalı; yönetim üyeliği değişmemeli. Sonrasında \q ile çıkın. LOGIN açıldıktan sonra hazırlık aşamasının NOLOGIN şartlı bootstrap-role.sql / prepare-schema.sql dosyalarını yeniden çalıştırmayın.

6. **Prisma ayarları:** Yalnızca Git dışındaki apps/api/.env.migration dosyasını güvenilir, senkronizasyon/AI aktarımı yapmayan yerel editörde düzenleyin. Dosyayı yalnızca sizin Windows hesabınız ve güvenilen sistem yöneticileri okuyabilsin. Git ignore şifreleme değildir. Çalışan apps/api/.env SQLite ayarlarını değiştirmeyin; mevcut yedek yollarını ve diğer alanları koruyun.

| Alan | İçerik |
| --- | --- |
| DATABASE_URL | Session Pooler hostu, 5432, postgres; creator_hq_runtime.PROJECT_REF ve yeni runtime parolası |
| DIRECT_URL | Aynı Session Pooler hostu, 5432, postgres; postgres.PROJECT_REF ve mevcut yönetici veritabanı parolası |
| SUPABASE_PROJECT_REF | Gerçek proje referansı; proje görünen adı değil |

İki Prisma URL'sinde de schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5 bulunmalı. Gerekirse URL kodlanmış mutlak CA yolu ile sslrootcert eklenir. Paroladaki ayrılmış karakterler yalnızca yerelde, ekrana yazdırılmadan bir kez URL kodlanır; çevrim içi kodlama sitelerine gönderilmez. Rastgele URL güvenli karakterli runtime parolası bu işlemi kolaylaştırır; mevcut yönetici parolası ayrıca doğru kodlanmalıdır. Prisma 6.19.3 burada require + strict kullanır; psql verify-full kullanır. 6543 veya pgbouncer=true eklemeyin. DIRECT_URL adı IPv6 zorunluluğu getirmez. API anahtarı, veritabanı parolası değildir.

7. **Salt okunur runtime bağlantısı — canlı bağlantı onayından sonra:** Yeni bağlantıyı gerçek runtime kullanıcısıyla açın. SQL Editor'daki SET ROLE, parolalı bağlantının kanıtı değildir.

~~~powershell
$runtimeUser = 'creator_hq_runtime.' + $projectReference
& $pgClient -X -W -v 'HISTFILE=NUL' -v 'ON_ERROR_STOP=1' -h $poolerHost -p 5432 -U $runtimeUser -d postgres
~~~

Terminal proje kökünde açıldıysa psql içinde:

~~~text
\conninfo
\i apps/api/prisma/postgresql/security/inspect-runtime-connection.sql
~~~

Yeni SQL yalnızca READ ONLY transaction kullanır. Beklenen: current_user=session_user=creator_hq_runtime, veritabanı postgres, USAGE=true / CREATE=false ve beklenen yönetim üyeliği. Runtime'ın üye olduğu başka rol bulunmamalı. Şema boşken table_permission_status=NOT_TESTED_NO_TABLES olmalı; tablo CRUD/RLS testi geçmiş sayılmaz. Havuz arkasındaki pg_stat_ssl kaydı tek başına istemci–pooler TLS kanıtı değildir.

İki özel URL girildikten ve canlı bağlantı testi onaylandıktan sonra mevcut Prisma kontrolü de kullanılabilir:

~~~powershell
npm run db:migrate -- --check-connection
~~~

Bu komut veri yazmaz veya uygulamayı PostgreSQL'e geçirmez. Uygulama tabloları yokken tam --preflight çalıştırmayın. --apply-schema, --apply-data, --probe-write kullanmayın. MIGRATION_SCHEMA_APPROVED, MIGRATION_DATA_APPROVED, MIGRATION_PROBE_APPROVED ve MIGRATION_SOURCE_FROZEN false kalmalı; cutover onayı açılmamalı. SQLite ve yedekler korunur.

Bu bağlantı hazırlığının yerel doğrulaması: typecheck başarılı; 12 veritabanı/güvenlik testi ve 5 politika testi geçti. Public audit 82 aday dosyada bulgu vermedi. PGlite testleri canlı TLS/parola doğrulaması değildir; canlı bağlantı yapılmadı. Yeni SQL, SET ROLE oturumunu gerçek runtime kimlik doğrulamasından ve boş şemayı tablo izinlerinin doğrulanmasından ayırıyor. Araçlar PATH üzerinde bulunamadı; kurulum yapılmadı. Python kullanılmadı; SQLite ve mevcut yedekler değiştirilmedi.

## Session Pooler TLS sertifika hazırlığı

psql, pg_dump ve pg_restore kurulu dosyalarından kontrol edildi; üçü de 17.11. Aktif SQLite ayarları değişmedi; migration URL'leri boş. Kontrol edilen varsayılan libpq CA dosyası ve Creator HQ'ya özel CA dosyası henüz yok. Dashboard SSL enforcement ayarı bu oturumda doğrulanmadı veya değiştirilmedi.

1. Mevcut Supabase projesinde **Database Settings → SSL Configuration → Download certificate** bölümünden güvenilir kök CA'yı indirin. Hostu **Connect → Session Pooler** bölümünden ayrı alın. Tarayıcının site/leaf sertifikasını veya rastgele bir siteden alınan sertifikayı kullanmayın.
2. Önerilen özel konum: **%LOCALAPPDATA%\CreatorHQ\certificates\supabase\creator-hq-ca.crt**. Repo, vault, medya veya yedek klasörüne koymayın. Dosya CA sertifikasıdır; özel anahtar değildir. PEM içeriğini değiştirmeden kaydedin. Klasör yazma izinlerini kendi hesabınız ve güvenilen sistem/yönetici hesaplarıyla sınırlı tutun. Windows'un genel güvenilir kök deposuna import gerekmez; başka uygulamaların root.crt dosyası değiştirilmez.
3. [Hazır PowerShell komutu ve klasör oluşturma adımı](docs/supabase-connection-plan.md#tls-only-preparation-after-client-installation) yalnızca plan olarak hazırlandı, çalıştırılmadı. Komut sslmode=verify-full eşdeğeri PGSSLMODE ve açık PGSSLROOTCERT kullanır. Hem sertifika zincirini hem gerçek pooler hostname'ini doğrular. Native istemci TLS ayarı, Prisma 6'nın require + strict URL ayarından ayrıdır.
4. Runtime hâlâ NOLOGIN olduğu için bu kontrol mevcut postgres yönetici hesabıyla planlandı. -W yalnızca mevcut yönetici parolasını gizli istemde sorar; parola komut argümanına, URI'ye veya SQL'e yazılmaz. -X başlangıç dosyalarını atlar; komut yalnızca bağlantı bilgisini ve READ ONLY kimlik sorgusunu gösterip kapanır. Beklenen postgres / postgres / on ve SSL/TLS bağlantı bilgisidir. Başarılı verify-full kurulumu olmadan TLS doğrulandı denmez.
5. Doğrulama hatasında durun; TLS modunu düşürmeyin. Global enforcement veya Data API ayarını değiştirmeyin. Parola belirleme, LOGIN, migration, veri aktarımı veya uygulama geçişi bu adımın kapsamında değildir. Python kullanılmadı.

## Son geçiş öncesi özel yapılandırma

**Bu aşamada yalnızca yerel hazırlık ve salt okunur kontroller yetkilidir.** Canlı şema migration'ı, veri aktarımı ve uygulama geçişi ayrı onay gerektirir. [Güncel hazırlık ve kanıt raporu](docs/phase12-final-preparation.md).

1. Güvenilir yerel editörde yalnızca apps/api/.env.migration dosyasını açın. Ekran görüntüsü, sohbet veya terminale içeriğini dökmeyin; senkronizasyon/AI aktarımı olmayan editör ve kısıtlı NTFS erişimi kullanın. Aktif apps/api/.env dosyası SQLite olarak kalacak.
2. Supabase Connect → Session Pooler ekranındaki gerçek URI'yi terminal yerine doğrudan özel dosyada şablon olarak kullanın. DATABASE_URL satırında creator_hq_runtime.PROJECT_REF ve mevcut runtime parolası; DIRECT_URL satırında postgres.PROJECT_REF ve mevcut yönetici veritabanı parolası bulunmalı. İkisinde de gerçek pooler hostu, 5432 ve postgres veritabanı aynı olmalı. SUPABASE_PROJECT_REF alanı gerçek referans, proje görünen adı değil.
3. Yalnızca parola bileşenini yerelde bir kez URL kodlayın; tüm URI'yi kodlamayın. @ → %40, # → %23 ve yüzde işareti → %25 örneklerdir. Önceden kodlanmış yüzde işaretlerini tekrar kodlamayın. Çevrim içi encoder, parola yazdıran PowerShell komutu veya sohbet kullanmayın. Mevcut parolaları değiştirmeyin.
4. İki Prisma URL'sinde şu parametreler bulunsun: schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5. Başarılı TLS testinizdeki gerçek CA yolunu sslrootcert parametresine URL kodlanmış mutlak yol olarak ekleyin; Windows yolunda ileri eğik çizgi kullanmak kolaylaştırır. Önceden önerilen CA konumu burada bulunamadı; o yolu varsaymayın. Native psql verify-full ile Prisma 6'nın require + strict ayarları farklı söz dizimleridir; doğrulamayı gevşetmeyin.
5. PG_DUMP_BIN ve PG_RESTORE_BIN için kurulu 17.11 araçlarının mutlak yollarını özel dosyada çift tırnak içinde belirtin. Bunlar sırasıyla PostgreSQL 17 bin klasöründeki pg_dump.exe ve pg_restore.exe olmalı. PATH değişikliği zorunlu değil. Var olan kaynak SQLite, yedek manifesti ve BACKUP_DIR alanlarını koruyun; dosyayı baştan ezmeyin.
6. MIGRATION_SCHEMA_APPROVED, MIGRATION_DATA_APPROVED, MIGRATION_PROBE_APPROVED ve MIGRATION_SOURCE_FROZEN false kalmalı. Cutover onayı açmayın. Kimlik bilgilerini NEXT_PUBLIC değişkenlerine koymayın. Yerel dosyayı doldurunca yalnızca **“Yapılandırma hazır”** deyin; URL, parola veya dosya içeriğini göndermeyin.

Sonraki yetkili salt okunur komut:

~~~powershell
npm run db:migrate -- --check-connection
~~~

Bu oturumda komut çalıştırıldı ve boş DATABASE_URL nedeniyle DATABASE_URL_REQUIRED ile bağlantı açmadan durdu. Şema boşken tam --preflight henüz tablo doğrulaması yapamaz. Veri yazan --probe-write / --apply-schema / --apply-data komutlarını onaydan önce kullanmayın.

SQLite ve gerçek manifest yedeği yeniden salt okunur doğrulandı: 9 ajan, 0 görev, 3 etkinlik, 3 onay, 2 stüdyo ayarı ve 3 rapor; tüm alan/ID/ilişki doğrulamaları ve fingerprint eşleşti. İnceleme kaynak dosyanın baytlarını değiştirmedi. Prisma şeması geçerli. Üç native araç 17.11; mevcut yedekleme komutunun --check-tools kontrolü de geçti. Gerçek PostgreSQL yedeği veya geri yükleme başarısı henüz iddia edilmiyor.

Şema onayı istenirken 10 tablo, RLS/yetkiler ve migration'ın eklediği 3 statik Studio referans kaydı ayrıca açıklanacak. SQLite verilerinin aktarımı ile geçici, geri alınan yazma testi ayrı onayla yapılacak; başarılı kaynak/hedef kontrolü ve yedek/geri yükleme kanıtından sonra uygulama geçişi için ayrıca onay istenecek. Silme, reset ve geri dönüş işlemleri otomatik yapılmaz.

Bu son hazırlık turunda typecheck, 12 migration/güvenlik testi ve 5 politika testi geçti; public audit 83 dosyada bulgu vermedi. Testler izole fixture kullanır; canlı bağlantı/aktarım kanıtı değildir. Bu turda uygulama yeniden derlenmedi veya başlatılmadı; aktif sağlayıcı değiştirilmedi. Eksik özel yapılandırma tamamlanmadan şema migration onayı talep edilmiyor.

## Runtime URL parola düzeltme yardımcısı

Yardımcı hazırlandı ve kaynak kodu incelendi; **gerçek dosyada çalıştırılmadı, parola istenmedi veya yazılmadı.** [İngilizce güvenlik incelemesi](docs/runtime-password-repair.md).

Yalnızca mevcut DATABASE_URL parola bileşenini değiştirir. Ham runtime parolası normal yerel PowerShell terminalinde iki gizli istemle alınır; karakter, yıldız veya parola uzunluğu gösterilmez. encodeURIComponent yalnızca bir kez uygulanır. DIRECT_URL, proje/TLS/araç yolları, SQLite bilgileri, yorumlar ve diğer satırlar bayt düzeyinde korunur. Onay bayrakları false değilse işlem durur; onları değiştirmez.

TTY/raw giriş sağlanamazsa, debugger/profiler varsa, dosya Git tarafından yok sayılmıyorsa veya izleniyorsa parola istenmez. Gizli giriş mümkün değilse düz metin girişe geçilmez; normal Windows Terminal/PowerShell kullanılmalı, hâlâ mümkün değilse işlem durmalıdır. Parolayı Codex sohbetine, argümana veya ortam değişkenine yazmayın.

**Yalnızca ayrıca açık onay verdikten sonra**, kendi yerel terminalinizde proje kökünden kullanılacak komut:

~~~powershell
npm run db:fix-runtime-password -- --operator-approved
~~~

Çalıştırmadan önce editörlerde dosyayı kapatın; terminal kayıt/transcript/debug yakalaması açık olmamalı. Bu bayrak tek başına operatör onayının yerine geçmez. Yardımcı dosyayı yerinde günceller; inode/NTFS izinleri korunur, ek bir gizli dosya kopyası oluşturulmaz. Yazma hatasında özgün içerik bellekten geri yüklenmeye çalışılır. Güç kesintisi veya kurtarılamayan disk arızası için atomiklik garantisi yoktur. Kurtarma hatasında dosyayı kullanmadan yerel inceleme gerekir. Tek tırnaklı özel bir dotenv biçimi güvenle korunamıyorsa dosyaya dokunmadan durur.

İşlem sonrasında yalnızca yerel yapılandırma, dosya ve bayt doğrulaması yapılır; otomatik canlı bağlantı, migration, aktarım veya cutover yoktur. Mevcut ortam dosyası düz metin eşdeğeri kimlik bilgileri içerir; Git ignore şifreleme değildir. JavaScript string belleğinin güvenli silinmesi garanti edilemez.

Sahte verilerle 9 test geçti; görünür girişe düşmeme, özel karakter/Unicode/tek kodlama, diğer baytların korunması, eşzamanlı değişiklik ve yazma hatası davranışları kontrol edildi. Gerçek parola veya gerçek terminaldeki parola istemi denenmedi. Typecheck ve mevcut 5 politika testi geçti. Python kullanılmadı.

Prisma 6.19.3 TLS sorunu, güvenli düzeltme ve gerçek salt okunur test sonuçları: [teknik rapor](docs/prisma-tls-recovery.md). Canlı migration henüz uygulanmadı; yeniden deneme ayrıca onay gerektirir.

Ayrı onay verilen Phase 1.2 canlı şema migration’ı başarıyla tamamlandı. 10 uygulama tablosu ve migration geçmişi doğrulandı; veri aktarımı ve uygulama geçişi yapılmadı: [doğrulama raporu](docs/schema-migration-result.md).

İlk onaylı canlı veri aktarımı hatayla durdu; hedefte kısmi aktarım yok ve uygulama SQLite kullanmaya devam ediyor: [aktarım raporu](docs/data-transfer-attempt.md).

Timestamp aktarım düzeltmesi yalnızca yerelde tamamlandı; izole Prisma regresyon testleri geçti. Canlı yeniden deneme ayrıca onay bekliyor: [teknik rapor](docs/timestamp-transfer-fix.md).

Düzeltilmiş kodla ayrı onay verilen canlı aktarım tamamlandı; kaynak/hedef kayıtları eşleşti. Uygulama SQLite üzerinde kaldı; PostgreSQL yedek/geri yükleme doğrulaması ve uygulama geçişi bekliyor: [canlı aktarım raporu](docs/data-transfer-result.md).

Gerçek PostgreSQL yedeği oluşturuldu ve liste/hash kontrolü geçti; izole geri yükleme doğrulanamadığından uygulama geçişi kapalı: [yedekleme raporu](docs/backup-restore-result.md).

Resmî EDB 17.11-5 x64 paketinin dijital imzası doğrulandı; Windows --help başlatmasını EACCES ile engelledi. Çıkarma ve native geri yükleme yapılmadı: [paket durumu](docs/native-restore-extraction-status.md).

Gerçek native PostgreSQL 17.11 geri yükleme ve veri/yetki karşılaştırmaları geçti. Geçici küme kapatıldı; Creator HQ son onay beklerken SQLite üzerinde kaldı: [doğrulanmış restore raporu](docs/native-restore-result.md).

Güncel geçiş durumu: PostgreSQL aktif; bağlantı hatası yanıtları ve tarayıcı testleri tamamlanmadığından yazmalar kapalı. Altı test kaydı temizlendi: [doğrulama durumu](docs/cutover-verification.md).

Phase 1.2 geçişi tamamlandı: uygulama kısıtlı Supabase PostgreSQL hesabını kullanıyor, yazmalar açık; 44 otomatik test ve canlı/tarayıcı kontrolleri geçti. Test kaydı kalmadı. [Son doğrulama ve başlatma](docs/phase12-cutover-completed.md).

Phase 1.3 yerel adayı: 55 test, typecheck ve izole API/web build kontrolleri geçti. Canlı uygulamaya henüz uygulanmadı; ayrıca onay bekliyor. [Doğrulama raporu](docs/phase13-local-verification.md).


### Phase 2.0 Paket 1 — yerel hazırlık

Devre dışı yürütme sözleşmesi, dokuz rol politikası, yalnızca sahte süreç kullanan adaptör ve TR/EN onay önizlemesi yerelde hazırlandı. Çalışan Phase 1.3 uygulamasına uygulanmadı. Gerçek Codex çağrısı veya canlı migration yapılmaz. [Teknik sözleşme ve sonraki onay kapıları](docs/phase20-execution-contract.md) (İngilizce).
### Phase 2.0 Paket 4 — yerel entegrasyon

Atlas işi ve sahip onayı için kapalı yürütme entegrasyonu [Paket 4 teknik belgesinde](docs/phase20-package4.md) açıklanır. Yerel kaynak paketi üretim ajanlarını etkinleştirmez ve canlı şema migration'ı gerektirmez.

Paket 5, sahip kimlik doğrulaması hazırlığını ve model çağrısız CLI protokol testlerini ekler. [Hazırlık ve onay sınırları](docs/phase20-package5.md) · [Doğrulama sonuçları](docs/phase20-package5-verification.md). Üretim yürütmesi kilitli kalır.

Sonraki [Atlas etkinleştirme incelemesi](docs/activation/README.md), SQL, geri alma ve kilitli worker değişikliklerini içerir. Canlı veritabanına veya uygulamaya uygulanmamıştır.

