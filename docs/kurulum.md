# Kurulum ve Dağıtım

MÜSİAD Faaliyet Değerlendirme Sistemi'nin sıfırdan kurulumu. İki parça var: Laravel API (`backend/`) ve React arayüzü (kök dizin, çıktısı `dist/`).

Arayüz statik dosyalardan ibarettir; API ile aynı sunucuda ya da ayrı bir yerde durabilir. Ayrı duracaksa CORS ayarı zorunludur — [CORS](#cors) bölümüne bakın.

---

## Gereksinimler

| | Sürüm | Not |
|---|---|---|
| PHP | 8.3 veya üzeri | `composer.json` `^8.3` ister |
| PHP eklentileri | `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `tokenizer`, `xml`, `curl`, `gd`, `zip` | `gd` olmadan **PDF raporu 500 döner** |
| OPcache | açık | Kapalıysa uygulama **6–7 kat yavaş** çalışır — [Performans](#performans) |
| Composer | 2.x | |
| MySQL | 8.0 | CI bu sürümle sınanıyor |
| Node.js | 22 veya üzeri | Yalnızca derleme için; sunucuda çalışmaz |

Eklentileri doğrulayın:

```bash
php -m | grep -E "pdo_mysql|mbstring|gd|zip|curl|fileinfo"
```

Zamanlanmış görev **yok** — cron kurmanız gerekmiyor. Kuyruk işçisi de **gerekmiyor**; bildirimler istek içinde senkron yazılır.

---

## 1. Veritabanı

```sql
CREATE DATABASE musiad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'musiad'@'localhost' IDENTIFIED BY 'GUCLU_BIR_PAROLA';
GRANT ALL PRIVILEGES ON musiad.* TO 'musiad'@'localhost';
FLUSH PRIVILEGES;
```

Karakter seti `utf8mb4` olmalı; şube ve faaliyet adlarında Türkçe karakterler var.

---

## 2. Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

### .env ayarları

Canlı ortamda mutlaka değiştirilecekler:

```ini
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.faaliyet.musiad.org.tr

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=musiad
DB_USERNAME=musiad
DB_PASSWORD=GUCLU_BIR_PAROLA

# Arayüzün adresi — virgülle birden fazla yazılabilir
CORS_ALLOWED_ORIGINS=https://faaliyet.musiad.org.tr

# Oturum jetonu ömrü, dakika (varsayılan 720 = 12 saat)
SANCTUM_EXPIRATION=720

# Ters vekilin adresi — ayrıntı için Güvenlik bölümüne bakın
TRUSTED_PROXIES=127.0.0.1,::1
```

> **`APP_DEBUG=false` şart.** Açık kalırsa hata sayfaları veritabanı bilgilerini ve dosya yollarını dışarıya gösterir.

> **`APP_KEY` bir daha değişmemeli.** Değişirse mevcut oturumlar ve şifrelenmiş veriler geçersiz olur. Yedekleyin.

### Şema ve ilk hesap

```bash
php artisan migrate --force
php artisan db:seed --force
```

Seeder üç demo hesap açar (`DemoUsersSeeder`):

| E-posta | Rol | Parola |
|---|---|---|
| avni.kucuk@musiad.org.tr | Süper Admin | `admin123` |
| huseyin.ozer@musiad.org.tr | Birim Yöneticisi | `birim123` |
| ankara@musiad.org.tr | Şube Yöneticisi | `sube123` |

> **Canlıya çıkmadan bu parolalar değiştirilmeli.** Sistemde kullanıcının kendi parolasını değiştireceği bir ekran **yok**; parolaları yalnızca Süper Admin, Kullanıcılar ekranından atar. İlk Süper Admin'in parolasını da bu yüzden aşağıdaki gibi elle değiştirmeniz gerekir:

```bash
php artisan tinker --execute="
App\Models\User::where('email','avni.kucuk@musiad.org.tr')
    ->update(['password' => Hash::make('YENI_PAROLA')]);
"
```

Demo birim/şube/kullanıcıları istemiyorsanız `db:seed` adımını atlayıp Süper Admin'i doğrudan tinker ile oluşturun.

### Performans ayarları

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

> Bu komutlardan sonra `.env` değişiklikleri **okunmaz**. `.env`'i her değiştirdiğinizde `php artisan config:cache` komutunu tekrar çalıştırın.

### Yazma izinleri

`storage/` ve `bootstrap/cache/` dizinleri web sunucusu kullanıcısına yazılabilir olmalı:

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

### Web kökü

Sanal sunucunun kök dizini **`backend/public`** olmalı — `backend` değil. Aksi halde `.env` dosyası internetten okunabilir hale gelir.

---

## 3. Arayüz

API adresi **derleme anında** gömülür; sonradan değiştirilemez, yeniden derlemek gerekir.

```bash
# proje kökünde
npm ci
VITE_API_URL=https://api.faaliyet.musiad.org.tr/api npm run build
```

`/api` son eki dahil yazılmalı. Çıktı `dist/` klasörüne düşer; içeriğini web sunucusuna kopyalayın.

### SPA yönlendirmesi

Uygulama tek sayfadır ve yönlendirmeyi tarayıcıda yapar. Sunucu, bulunmayan yolları `index.html`'e düşürmelidir:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Apache kullanıyorsanız `dist/` içine bir `.htaccess` ile aynı davranışı kurun.

---

## CORS

Arayüz ile API farklı adreslerdeyse `CORS_ALLOWED_ORIGINS` **zorunludur**. Değişken boş bırakılırsa liste boş kalır ve tarayıcı bütün istekleri engeller — bu bilinçli bir tercih: değişken unutulursa API dışarıya açılmaz.

```ini
CORS_ALLOWED_ORIGINS=https://faaliyet.musiad.org.tr
```

Adresi protokolüyle birlikte, sonunda eğik çizgi olmadan yazın. Birden fazlaysa virgülle ayırın.

Üretim dışı ortamlarda tüm `localhost` portları ayrıca kabul edilir; `APP_ENV=production` iken bu kural devre dışıdır.

---

## Doğrulama

Kurulumdan sonra sırayla:

```bash
# 1. API ayakta mı
curl -i https://api.faaliyet.musiad.org.tr/api/auth/login \
  -X POST -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"email":"...","password":"..."}'
```

`200` ve bir `token` dönmeli. `500` geliyorsa `backend/storage/logs/laravel.log` dosyasına bakın.

2. Arayüzü tarayıcıda açıp giriş yapın. Giriş ekranı geliyor ama giriş çalışmıyorsa, tarayıcı konsolunda CORS hatası olup olmadığına bakın.
3. Süper Admin ile **Raporlar → PDF İndir**'i deneyin. Bu adım `gd` eklentisini sınar; eksikse burada 500 alırsınız.
4. Bir şube hesabıyla girip **Faaliyetlerim**'i açın.

---

## Güvenlik

### Ters vekil (zorunlu)

Nginx veya Apache arkasında çalışıyorsanız `TRUSTED_PROXIES` **doğru ayarlanmalıdır.**

```ini
# Vekil aynı makinedeyse (en yaygın kurulum)
TRUSTED_PROXIES=127.0.0.1,::1

# Vekil başka bir sunucudaysa
TRUSTED_PROXIES=10.0.0.5

# Yük dengeleyici arkasındaysanız ve uygulamaya SADECE onun üzerinden erişilebiliyorsa
TRUSTED_PROXIES=*
```

Yanlış ayarlandığında iki şey bozulur:

- **Boş bırakılırsa** Laravel her isteğin vekilden geldiğini sanır. Giriş ekranındaki IP başına sınır tüm kullanıcılar için tek kovaya düşer — bir saldırgan dakikada 20 istekle herkesin girişini kilitleyebilir. Günlüklere de gerçek IP yazılmaz.
- **`*` yapılırsa ve uygulamaya vekil dışından da erişilebiliyorsa** herkes `X-Forwarded-For` başlığıyla kendi IP'sini uydurup kilidini atlatabilir.

### Yanıt başlıkları

Uygulama `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` ve dar bir `Content-Security-Policy` gönderir; `X-Powered-By` kaldırılır. Ek ayar gerekmez.

**HSTS** yalnızca https üzerinden gönderilir:

```ini
HSTS_AKTIF=true
HSTS_SURE=31536000        # 1 yıl
HSTS_ALT_ALANLAR=false    # dikkat: aşağıya bakın
```

> `HSTS_ALT_ALANLAR=true` yapmadan önce **bütün alt alanların https sunduğundan emin olun.** Tarayıcı bu talimatı süre boyunca hatırlar; https'e geçmemiş bir alt alan erişilemez hale gelir ve bunu geri almak kolay değildir.

Web sunucusunda `http → https` kalıcı yönlendirmesi de kurulmalıdır; HSTS ancak kullanıcı bir kez https ile bağlandıktan sonra korur.

### Hız sınırları

Kimliği doğrulanmış uçlar kullanıcı başına sınırlıdır:

```ini
HIZ_LIMITI_GENEL=120      # dakikada istek
HIZ_LIMITI_RAPORLAR=20    # raporlar en pahalı uçlar
```

Giriş ekranının kendi kilidi bunlardan ayrıdır (e-posta + IP başına 5 deneme, 15 dakika). Sınır kullanıcı kimliğine göre tutulur, IP'ye göre değil — aynı kurumdan çalışan iki kullanıcı birbirinin hakkını yemez.

---

## Performans

Uygulamanın hızını belirleyen şey sorgular değil, **PHP'nin her istekte Laravel'i yeniden derleyip derlemediği.** Ölçüm (aynı sunucu, aynı veri):

| Uç | OPcache kapalı | OPcache + önbellek açık |
|---|---|---|
| `/api/birimler` | 235 ms | **39 ms** |
| `/api/subeler` | 245 ms | **35 ms** |
| `/api/raporlar/{id}` | 283 ms | **66 ms** |

Uygulama mantığı bu sürelerin küçük bir kısmı: bir dönemin tüm puanlaması 5 sorgu ve ~12 ms. Geri kalanı önyükleme maliyeti.

### OPcache

`php.ini` içinde açık olmalı:

```ini
zend_extension=opcache
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.interned_strings_buffer=16
; Üretimde dosya değişikliği kontrolünü kapatmak ek hız verir,
; ama her dağıtımdan sonra PHP-FPM yeniden başlatılmalıdır:
; opcache.validate_timestamps=0
```

Açık olduğunu doğrulayın:

```bash
php -m | grep -i opcache
```

> Eklentiyi kurduktan sonra **PHP-FPM'i yeniden başlatın**. Çalışan süreç eski yapılandırmayı taşır; `php -m` doğru görünse bile web isteklerine yansımaz.

### Laravel önbellekleri

[Performans ayarları](#performans-ayarları) bölümündeki `config:cache`, `route:cache` ve `view:cache` komutları tek başına ~%25 kazandırır; OPcache ile birlikte yukarıdaki tabloyu verir.

### CORS preflight

Arayüz jeton başlığı gönderdiği için tarayıcı istekleri "basit" saymaz ve her çağrıdan önce bir `OPTIONS` isteği atar. `CORS_MAX_AGE` (varsayılan 86400 saniye) bu yanıtın tarayıcıda saklanmasını sağlar; ilk çağrıdan sonra ek tur ortadan kalkar. Sıfıra çekmek her isteği ikiye katlar.

---

## Yedekleme

Yedeklenmesi gerekenler:

- **Veritabanı** — bütün veri burada.
- **`backend/.env`** — özellikle `APP_KEY`.

```bash
mysqldump -u musiad -p --single-transaction --default-character-set=utf8mb4 musiad \
  > musiad-$(date +%F).sql
```

Yüklenen dosya yoktur (sistem faaliyet kayıtlarına dosya eki almaz), `storage/` yalnızca günlük ve önbellek tutar.

---

## Güncelleme

```bash
cd backend
php artisan down                       # bakım moduna al
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan up

cd ..
npm ci
VITE_API_URL=https://api.faaliyet.musiad.org.tr/api npm run build
# dist/ içeriğini web köküne kopyalayın
```

Migration çalıştırmadan önce veritabanı yedeği alın.

---

## Sık karşılaşılanlar

**PDF indirirken 500** — `gd` eklentisi kurulu değil ya da PHP-FPM yeniden başlatılmamış. Eklentiyi kurup `systemctl restart php8.3-fpm` çalıştırın. (`php -m` doğru görünse bile çalışan süreç eski yapılandırmayı taşıyor olabilir.)

**Girişte "Çok fazla hatalı deneme"** — aynı e-posta ve IP için 5 hatalı denemeden sonra 15 dakika kilit devreye girer. Beklemek ya da `php artisan cache:clear` çalıştırmak gerekir.

**Kullanıcı bir cihazda girince diğerinden düşüyor** — bilinçli davranış. Her yeni giriş önceki jetonları geçersiz kılar; aynı hesapla iki cihazda aynı anda çalışılamaz.

**`.env` değişikliği etkisiz** — yapılandırma önbelleklenmiş. `php artisan config:cache` çalıştırın.

**Arayüz açılıyor ama veriler gelmiyor** — büyük olasılıkla `VITE_API_URL` yanlış ya da hiç verilmeden derlenmiş; bu durumda `http://127.0.0.1:8000/api` varsayılanına düşer. Doğru değerle yeniden derleyin.

**Sayfalar geç açılıyor, her tıklama bekletiyor** — neredeyse her zaman OPcache kapalıdır. `php -m | grep -i opcache` ile kontrol edin; kuruluysa PHP-FPM'i yeniden başlatmayı unutmayın. Ardından `config:cache` çalıştırılmış mı bakın. [Performans](#performans) bölümünde ölçümler var.

**Geliştirme ortamında her istek iki kez gidiyor** — `React.StrictMode` etkileri bilerek iki kez çalıştırır. Üretim derlemesinde olmaz, bir sorun değildir.

**Kullanıcılar "çok fazla istek" (429) hatası alıyor** — hız sınırına takılıyorlar. Normal kullanımda dakikada 120 istek fazlasıyla yeterlidir; sık görülüyorsa ya bir istemci döngüye girmiştir ya da `TRUSTED_PROXIES` yanlış olduğu için sınır herkes adına tek kovada tutuluyordur. Önce vekil ayarını kontrol edin.

**Giriş kayıtlarında hep aynı IP görünüyor** — `TRUSTED_PROXIES` ayarlanmamış. Vekilin adresi tanımlanana kadar gerçek istemci IP'si okunamaz.
