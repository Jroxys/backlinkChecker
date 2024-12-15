import os.path
import requests
import re
from bs4 import BeautifulSoup
from requests.exceptions import RequestException
import socket
import time
#GET LINKS ----> CHECK IF THEY ARE VALID -----> CHECK IF CONTENT IS EXIST -----> IF DELETED SEND EMAIL ------>
#First check if file exists.
fileDirectory = "links.txt"
fileDirectoryBacklink = "backlinks.txt"
fileObject = open(fileDirectory,"r+",encoding="utf-8")
fileObjectBacklink = open(fileDirectoryBacklink,"r+",encoding="utf-8")

linkList = [] #Links from txt file.
notWorkingLinks = [] #Links which is not working
ourLinks = [] #backlink links
deletedBacklinks = [] #deleted backlinks

checkEmpty = os.path.getsize(fileDirectory) == 0
checkEmptyBacklink = os.path.getsize(fileDirectoryBacklink) == 0

def getLinks():
    if checkEmpty:
        print("File is empty please add some links.")
    else:
        for files in fileObject:
            linkList.append(files.strip())
    if checkEmptyBacklink:
        print("File is empty please add your backlinks.")
    else:
        for file in fileObjectBacklink:
            ourLinks.append(file.strip())
        

def checkLinks():
    #Checks for valid links.
    for link in linkList[:]: 
        getLinks()      
        try:
            response = requests.get(link,timeout=10,allow_redirects=True)
            responseCode = response.status_code
            response.raise_for_status()
            content_type = response.headers.get('Content-Type', '').lower()
            if responseCode == 200 or 'text/html' in content_type:
                print(f"Website is existing.Checking for content: {link}")
                #Web site exists. Check content.
                try:
                    #Parse the content
                    bsObj = BeautifulSoup(response.content.decode(response.encoding, errors='ignore'), 'html.parser')
                    #Check for noindex meta tag
                    if not bsObj.findAll('meta', content=re.compile("noindex")):  
                        #Check for specific links
                        backlinks_found = []
                        time.sleep(0.45)
                        for pattern in ourLinks:
                            if bsObj.find('a', href=re.compile(pattern)):
                                backlinks_found.append(pattern)
                                continue
                            for scriptTag in bsObj.find_all('script'):
                                if scriptTag.string and re.search(pattern,scriptTag.string):
                                    backlinks_found.append(pattern)
                                    break
                    
                        if backlinks_found:
                            print(f"Backlinks found on {link}: {', '.join(backlinks_found)}")
                        else:
                            print(f"No backlinks found on {link}.")
                            deletedBacklinks.append(link)
                            linkList.remove(link)
                                    
                    else:
                        print(f"Noindex found on {link}. Status Code: {responseCode}")

                except socket.gaierror as se:
                    print(f"{link} is not valid link. {se}")
                except requests.exceptions.ConnectionError as ce:
                    print(f"{link} is not valid link. Removing... Error : {ce}")
                    linkList.remove(link)

                except Exception as parse_error:
                    print(f"Error processing content for {link}: {parse_error}")
                
            else:
                print(f"Website {link} is not valid. Status Code: {responseCode}")
                notWorkingLinks.append(link)
                linkList.remove(link)
        except RequestException as ree:
            print(f"Unexpected error please check link:{link} \n{ree}")
            notWorkingLinks.append(link)
            linkList.remove(link) 
        except requests.exceptions.Timeout:
            print(f"Request timed out for {link}. Removing from list.")
            notWorkingLinks.append(link)
            linkList.remove(link)
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {link}: {e}")
            notWorkingLinks.append(link)
            linkList.remove(link)
        except IndexError:
            print('You dont have any valid links.')

def editFile():
    fileObject.truncate(0)
    fileObject.seek(0)
    for links in linkList:
        fileObject.write(links)
        fileObject.write("\n")

        

                         
getLinks()
if linkList and ourLinks:
    checkLinks()
    editFile()
else:
    print("No valid links or backlink patterns to check.")


fileObject.close()
fileObjectBacklink.close()
#Summary
print("\nSummary:")
print(f"Valid Links Checked: {len(linkList)}")
print(f"Deleted Backlinks: {deletedBacklinks}")
print(f"Not Working Links: {len(notWorkingLinks)} - {notWorkingLinks}")
"""Bir takım hatalar mevcut, bunları sıralayayım.
getLinks() fonksiyonu, hep checkEmpty ve checkEmptyBacklink değişkenlerini kullanıyor. Ama fonksiyon her çağırıldığında güncellenmiyor. Bu da tutarsızlık yaratır.
Bağlantı başarısız olursa deletedLinks.append(link) çağırıyorsun ama bunu iki kez çağırıyorsun. Bu da hataya neden olabilir.
fileObject ve fileObjectBacklink açmışsın ama kapatmamışsın. Dosya ile işin bittikten sonra kapatmalısın.
Kod siteden gelen 200 durum koduna bakıyor ama bazı sunucular 200 durum kodunu yanlış yönlendirebiliyor bu da backlink sağlam olsa bile sağlam değilmiş gibi gösterebilir. Bunun için BeautifulSoup analizinden önce Content-Type başlığını kontrol etmelisin.
Sadece A etiketine bakarak backlinkleri kontrol etmişsin fakat kimi siteler bunu javascript ile yapıyor. Bunu da kontrol etmesi gerek.
"""